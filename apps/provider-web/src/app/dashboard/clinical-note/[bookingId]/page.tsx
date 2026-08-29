import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import ClinicalNoteClient from "./ClinicalNoteClient";

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

  // Upsert draft clinical note
  const { data: existingNote } = await supabase
    .from("clinical_notes")
    .select("id")
    .eq("booking_id", params.bookingId)
    .eq("status", "draft")
    .maybeSingle();

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
