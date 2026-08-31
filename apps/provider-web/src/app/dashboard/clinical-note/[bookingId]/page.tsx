import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import ClinicalNoteClient from "./ClinicalNoteClient";
import ClinicalNoteView from "./ClinicalNoteView";

export default async function ClinicalNotePage({ params }: { params: { bookingId: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: provider } = await supabase
    .from("providers")
    .select("id, name, credentials, specialty")
    .eq("user_id", user.id)
    .single();

  if (!provider || !provider) redirect("/dashboard");

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, service_type, status, patient_id, patient:users!patient_id(id, name, dob, gender, blood_group, known_conditions, current_medications, allergies, share_medical_records)")
    .eq("id", params.bookingId)
    .eq("provider_id", provider.id)
    .single();

  if (!booking) redirect("/dashboard");

  // Look up ANY existing note for this booking, regardless of status — not
  // just 'draft'. Filtering to status='draft' alone meant a submitted note
  // was never found again, so every "View Note" click created a brand-new
  // blank clinical_notes row instead of showing what was actually
  // submitted (same bug as the nursing/physio flows).
  const { data: existingNote } = await supabase
    .from("clinical_notes")
    .select("*")
    .eq("booking_id", params.bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingNote?.status === "submitted") {
    const [{ data: vitals }, { data: diagnoses }, { data: prescriptions }, { data: investigations }, { data: referrals }] = await Promise.all([
      supabase.from("vitals").select("*").eq("clinical_note_id", existingNote.id).maybeSingle(),
      supabase.from("clinical_note_diagnoses").select("*").eq("clinical_note_id", existingNote.id),
      supabase.from("prescriptions").select("drugs, pdf_url").eq("booking_id", params.bookingId),
      supabase.from("investigation_orders").select("tests, status").eq("booking_id", params.bookingId),
      supabase.from("hospital_referrals").select("id, status, urgency, hospital_partners(name)").eq("booking_id", params.bookingId),
    ]);
    return (
      <ClinicalNoteView
        note={existingNote}
        vitals={vitals}
        diagnoses={diagnoses ?? []}
        prescriptions={prescriptions ?? []}
        investigations={investigations ?? []}
        referrals={referrals ?? []}
        patient={booking.patient as any}
      />
    );
  }

  let noteId = existingNote?.id;
  if (!noteId) {
    const { data: newNote } = await supabase
      .from("clinical_notes")
      .insert({ booking_id: params.bookingId, patient_id: booking.patient_id, provider_id: provider.id })
      .select("id")
      .single();
    noteId = newNote?.id;
  }

  if (!noteId) redirect("/dashboard");

  // Fetch previous submitted notes for this patient (if sharing enabled)
  const patient = booking.patient as any;
  let previousNotes: any[] = [];
  if (patient?.share_medical_records !== false) {
    const { data: prev } = await supabase
      .from("clinical_notes")
      .select("id, created_at, submitted_at, presenting_complaints, clinical_note_diagnoses(clinical_description, plain_language_diagnosis, diagnosis_type), providers(name, credentials), vitals(bp_systolic, bp_diastolic, pulse_rate), safeguarding_flag")
      .eq("patient_id", booking.patient_id)
      .eq("status", "submitted")
      .neq("booking_id", params.bookingId)
      .order("submitted_at", { ascending: false })
      .limit(10);
    previousNotes = prev ?? [];
  }

  return (
    <ClinicalNoteClient
      noteId={noteId}
      bookingId={params.bookingId}
      provider={provider as any}
      patient={patient}
      previousNotes={previousNotes}
      serviceType={booking.service_type}
    />
  );
}
