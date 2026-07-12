import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const admin = createAdminSupabase();
  const { noteId, bookingId, noteData, vitalsData, diagnosesData, patientId, providerId } = await req.json();

  if (!noteId) return NextResponse.json({ error: "missing noteId" }, { status: 400 });

  // Strip noteData to only valid clinical_notes columns — extra keys (e.g.
  // current_medications_note, allergies_note) cause PostgREST to reject the update.
  const VALID_NOTE_COLUMNS = new Set([
    "people_in_attendance", "presenting_complaints", "chronic_issues",
    "history", "social_history", "general_examination", "systemic_examinations",
    "interventions", "recommendations", "follow_up_date", "safeguarding_flag",
  ]);
  const safeNoteData = Object.fromEntries(
    Object.entries(noteData ?? {}).filter(([k]) => VALID_NOTE_COLUMNS.has(k))
  );

  // 1. Submit the clinical note
  const now = new Date().toISOString();
  const { error: noteError } = await admin
    .from("clinical_notes")
    .update({
      ...safeNoteData,
      status: "submitted",
      submitted_at: now,
      updated_at: now,
    })
    .eq("id", noteId);

  if (noteError) return NextResponse.json({ error: noteError.message }, { status: 500 });

  // 2. Save vitals
  if (vitalsData && Object.values(vitalsData).some(v => v)) {
    await admin.from("vitals").insert({
      clinical_note_id: noteId,
      bp_systolic: vitalsData.bp_systolic ? parseInt(vitalsData.bp_systolic) : null,
      bp_diastolic: vitalsData.bp_diastolic ? parseInt(vitalsData.bp_diastolic) : null,
      pulse_rate: vitalsData.pulse_rate ? parseInt(vitalsData.pulse_rate) : null,
      pulse_rhythm: vitalsData.pulse_rhythm ?? null,
      temperature: vitalsData.temperature ? parseFloat(vitalsData.temperature) : null,
      temp_unit: vitalsData.temp_unit ?? "C",
      spo2: vitalsData.spo2 ? parseInt(vitalsData.spo2) : null,
      respiratory_rate: vitalsData.respiratory_rate ? parseInt(vitalsData.respiratory_rate) : null,
      weight: vitalsData.weight ? parseFloat(vitalsData.weight) : null,
      height: vitalsData.height ? parseFloat(vitalsData.height) : null,
    });
  }

  // 3. Save diagnoses
  if (diagnosesData?.length > 0) {
    await admin.from("clinical_note_diagnoses").insert(
      diagnosesData.map((d: any) => ({
        clinical_note_id: noteId,
        provider_id: providerId,
        patient_id: patientId,
        source: d.source,
        icd10_code: d.icd10_code,
        clinical_description: d.clinical_description,
        plain_language_diagnosis: d.plain_language_diagnosis,
        diagnosis_type: d.diagnosis_type ?? "primary",
        is_uncodified: d.is_uncodified ?? false,
      }))
    );
  }

  // 4. Update patient record with any new conditions/medications/allergies
  if (patientId) {
    const { data: patient } = await admin.from("users").select("known_conditions, current_medications, allergies").eq("id", patientId).single();
    if (patient) {
      const newConditions = noteData.chronic_issues?.added ?? [];
      const newMeds = (noteData.current_medications_note ?? []).filter((m: any) => m.status === "confirmed").map((m: any) => m.name);
      const existingConditions: string[] = patient.known_conditions ?? [];
      const merged = [...new Set([...existingConditions, ...newConditions])];
      if (merged.length !== existingConditions.length) {
        await admin.from("users").update({ known_conditions: merged }).eq("id", patientId);
      }
    }
  }

  // 5. Schedule follow-up notifications
  if (noteData.follow_up_date && patientId) {
    const followUp = new Date(noteData.follow_up_date);
    const dayBefore = new Date(followUp);
    dayBefore.setDate(dayBefore.getDate() - 1);
    dayBefore.setHours(9, 0, 0, 0);
    const morning = new Date(followUp);
    morning.setHours(8, 0, 0, 0);

    await admin.from("notifications_queue").insert([
      { patient_id: patientId, message: `Reminder: You have a follow-up appointment tomorrow, ${followUp.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}.`, send_at: dayBefore.toISOString(), type: "follow_up" },
      { patient_id: patientId, message: `Good morning! Your StreetdocMD follow-up is today, ${followUp.toLocaleDateString("en-NG", { day: "numeric", month: "long" })}. Please ensure you are available for your appointment.`, send_at: morning.toISOString(), type: "follow_up" },
    ]);
  }

  // 6. Safeguarding alert
  if (noteData.safeguarding_flag && patientId) {
    await admin.from("safeguarding_alerts").insert({
      clinical_note_id: noteId,
      patient_id: patientId,
      provider_id: providerId,
      resolved: false,
    });
  }

  // 7. Update booking status
  await admin.from("bookings").update({ status: "completed" }).eq("id", bookingId);

  // 8. Trigger visit summary generation (non-blocking)
  fetch(`${req.nextUrl.origin}/api/clinical-note/generate-summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ noteId }),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
