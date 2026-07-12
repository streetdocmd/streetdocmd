import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { buildPrescriptionPDF } from "@/lib/prescription-pdf";

function buildAbnormalVitals(vitals: any): any[] {
  if (!vitals) return [];
  const flags: any[] = [];
  const bp_s = vitals.bp_systolic;
  const bp_d = vitals.bp_diastolic;
  if (bp_s && (bp_s > 140 || bp_s < 90)) flags.push({ vital: "Blood Pressure", value: `${bp_s}/${bp_d} mmHg`, message: "Your blood pressure was outside the normal range. Your doctor noted this and included it in your recommendations." });
  const pr = vitals.pulse_rate;
  if (pr && (pr < 60 || pr > 100)) flags.push({ vital: "Pulse Rate", value: `${pr} bpm`, message: "Your heart rate was outside the normal range during the visit." });
  const temp = vitals.temperature;
  const unit = vitals.temp_unit ?? "C";
  if (temp) {
    const tempC = unit === "F" ? (temp - 32) * 5 / 9 : temp;
    if (tempC > 37.5) flags.push({ vital: "Temperature", value: `${temp}°${unit}`, message: "You had a fever during the visit. Your doctor has addressed this in your treatment plan." });
  }
  const spo2 = vitals.spo2;
  if (spo2 && spo2 < 94) flags.push({ vital: "Oxygen Saturation", value: `${spo2}%`, message: "Your oxygen level was below normal. Your doctor noted this and took appropriate action." });
  return flags;
}

function buildWhatWasDone(interventions: any): string {
  if (!interventions) return "The doctor examined you during this visit.";
  const done: string[] = [];
  if (interventions.history_taken) done.push("took your medical history");
  if (interventions.physical_exam) done.push("performed a physical examination");
  if (interventions.malaria_rdt) done.push(`tested you for malaria (result: ${interventions.malaria_result ?? "pending"})`);
  if (interventions.typhoid_test) done.push(`tested you for typhoid (result: ${interventions.typhoid_result ?? "pending"})`);
  if (interventions.wound_dressing) done.push("performed wound dressing");
  if (interventions.injection) done.push(`administered an injection (${interventions.injection_spec ?? ""})`);
  if (interventions.meds_dispensed) done.push("gave you medication on the spot");
  if (interventions.additional) done.push(interventions.additional);
  if (done.length === 0) return "The doctor examined you during this visit.";
  return `The doctor ${done.join(", ")} during this visit.`;
}

function buildRecommendations(recs: any): string {
  if (!recs) return "";
  const parts: string[] = [];
  if (recs.lifestyle_advice) parts.push(recs.lifestyle_advice);
  if (recs.dietary_advice) parts.push(`Diet: ${recs.dietary_advice}`);
  if (recs.rest_advised && recs.rest_days) parts.push(`Rest for ${recs.rest_days} days.`);
  if (recs.additional) parts.push(recs.additional);
  return parts.join(" ");
}

export async function POST(req: NextRequest) {
  const admin = createAdminSupabase();
  const { noteId } = await req.json();
  if (!noteId) return NextResponse.json({ error: "missing noteId" }, { status: 400 });

  // Fetch all related data
  const { data: note } = await admin
    .from("clinical_notes")
    .select("*, providers(name, credentials)")
    .eq("id", noteId)
    .single();

  if (!note) return NextResponse.json({ error: "note not found" }, { status: 404 });

  const { data: vitals } = await admin.from("vitals").select("*").eq("clinical_note_id", noteId).maybeSingle();
  const { data: diagnoses } = await admin.from("clinical_note_diagnoses").select("*").eq("clinical_note_id", noteId).order("diagnosis_type");
  const { data: prescriptions } = await admin.from("prescriptions").select("id, drugs").eq("booking_id", note.booking_id);
  const { data: investigationOrders } = await admin.from("investigation_orders").select("tests, status").eq("booking_id", note.booking_id);
  const { data: patientRow } = await admin.from("users").select("name").eq("id", note.patient_id).single();

  const complaints = note.presenting_complaints as any[];
  const reasonForVisit = complaints?.[0]?.description ?? "Home visit";
  const plainDiagnosis = (diagnoses ?? []).map((d: any) => d.plain_language_diagnosis || d.clinical_description).join(", ");
  const abnormalVitals = buildAbnormalVitals(vitals);
  const whatWasDone = buildWhatWasDone(note.interventions);

  const medications = (prescriptions ?? []).flatMap((p: any) =>
    (p.drugs as any[] ?? []).map((d: any) => ({
      name: d.name || d.drug_name,
      what_it_treats: plainDiagnosis,
      how_to_take: `${d.dosage || d.strength} ${d.frequency}`,
      duration: d.duration,
    }))
  );

  const investigationsFormatted = (investigationOrders ?? []).flatMap((order: any) =>
    (order.tests as any[] ?? []).map((t: any) => ({
      test_name: t.test_name,
      expected_timeline: "Results will be available within 24-48 hours",
    }))
  );

  const recommendations = buildRecommendations(note.recommendations);
  const providerName = `${(note.providers as any)?.name ?? ""}${(note.providers as any)?.credentials ? ` (${(note.providers as any).credentials})` : ""}`;

  await admin.from("visit_summaries").insert({
    clinical_note_id: noteId,
    patient_id: note.patient_id,
    visit_date: new Date().toISOString().split("T")[0],
    provider_name: providerName,
    reason_for_visit: reasonForVisit,
    plain_diagnosis: plainDiagnosis,
    abnormal_vitals: abnormalVitals.length > 0 ? abnormalVitals : null,
    what_was_done: whatWasDone,
    medications: medications.length > 0 ? medications : null,
    investigations: investigationsFormatted.length > 0 ? investigationsFormatted : null,
    recommendations: recommendations || null,
    follow_up_date: note.follow_up_date ?? null,
    visible_to_patient: true,
  });

  // Generate prescription PDF if drugs were prescribed
  const allDrugs = (prescriptions ?? []).flatMap((p: any) => p.drugs as any[] ?? []);
  if (allDrugs.length > 0) {
    try {
      const dateStr = new Date().toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
      const provider = note.providers as any;
      const pdfBytes = await buildPrescriptionPDF({
        refId: note.booking_id,
        date: dateStr,
        providerName: provider?.name ?? "Provider",
        providerCredentials: provider?.credentials ?? "",
        providerSpecialty: provider?.specialty ?? "",
        patientName: patientRow?.name ?? "Patient",
        diagnosis: plainDiagnosis,
        treatment: recommendations,
        followUp: note.follow_up_date ? `Follow up on ${note.follow_up_date}` : "",
        drugs: allDrugs,
      });

      const fileName = `${note.booking_id}.pdf`;
      const { error: uploadErr } = await admin.storage
        .from("prescriptions")
        .upload(fileName, pdfBytes, { contentType: "application/pdf", upsert: true });

      if (!uploadErr) {
        const { data: urlData } = admin.storage.from("prescriptions").getPublicUrl(fileName);
        const pdfUrl = urlData.publicUrl;
        // Update all prescription rows for this booking with the PDF URL
        await admin.from("prescriptions").update({ pdf_url: pdfUrl }).eq("booking_id", note.booking_id);
      }
    } catch {
      // PDF generation is non-critical — summary is already saved
    }
  }

  return NextResponse.json({ ok: true });
}
