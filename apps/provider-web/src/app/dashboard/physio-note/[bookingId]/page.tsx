import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import PhysioEncounterClient from "./PhysioEncounterClient";
import PhysioEncounterView from "./PhysioEncounterView";

export default async function PhysioNotePage({ params }: { params: { bookingId: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: provider } = await supabase
    .from("providers")
    .select("id, name, credentials, specialty, profession")
    .eq("user_id", user.id)
    .single();

  // A physiotherapy encounter is a physiotherapist-only capability.
  if (!provider || provider.profession !== "physiotherapist") redirect("/dashboard");

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, service_type, status, patient_id, patient:users!patient_id(id, name, dob, gender, known_conditions)")
    .eq("id", params.bookingId)
    .eq("provider_id", provider.id)
    .single();

  if (!booking) redirect("/dashboard");

  // See nursing-note/[bookingId]/page.tsx for why this looks up any
  // existing encounter (not just status='draft') — the same "View Note
  // always creates a blank duplicate" bug applied here too.
  const { data: existingEncounter } = await supabase
    .from("physiotherapy_encounters")
    .select("*")
    .eq("booking_id", params.bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingEncounter?.status === "submitted") {
    return <PhysioEncounterView encounter={existingEncounter} patient={booking.patient as any} />;
  }

  let encounterId = existingEncounter?.id;
  if (!encounterId) {
    const { data: newEncounter } = await supabase
      .from("physiotherapy_encounters")
      .insert({ booking_id: params.bookingId, patient_id: booking.patient_id, provider_id: provider.id })
      .select("id")
      .single();
    encounterId = newEncounter?.id;
  }

  if (!encounterId) redirect("/dashboard");

  return (
    <PhysioEncounterClient
      encounterId={encounterId}
      bookingId={params.bookingId}
      provider={provider as any}
      patient={booking.patient as any}
    />
  );
}
