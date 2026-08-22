import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import NursingEncounterClient from "./NursingEncounterClient";

export default async function NursingNotePage({ params }: { params: { bookingId: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: provider } = await supabase
    .from("providers")
    .select("id, name, credentials, specialty, profession")
    .eq("user_id", user.id)
    .single();

  // A nursing encounter is a nurse-only capability — a doctor/physio
  // provider does not get this workflow even if they somehow reach the URL.
  if (!provider || provider.profession !== "nurse") redirect("/dashboard");

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, service_type, status, patient_id, patient:users!patient_id(id, name, dob, gender, blood_group, known_conditions, current_medications, allergies)")
    .eq("id", params.bookingId)
    .eq("provider_id", provider.id)
    .single();

  if (!booking) redirect("/dashboard");

  const { data: existingEncounter } = await supabase
    .from("nursing_encounters")
    .select("id")
    .eq("booking_id", params.bookingId)
    .eq("status", "draft")
    .maybeSingle();

  let encounterId = existingEncounter?.id;
  if (!encounterId) {
    const { data: newEncounter } = await supabase
      .from("nursing_encounters")
      .insert({ booking_id: params.bookingId, patient_id: booking.patient_id, provider_id: provider.id })
      .select("id")
      .single();
    encounterId = newEncounter?.id;
  }

  if (!encounterId) redirect("/dashboard");

  return (
    <NursingEncounterClient
      encounterId={encounterId}
      bookingId={params.bookingId}
      provider={provider as any}
      patient={booking.patient as any}
    />
  );
}
