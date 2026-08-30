import { SERVICE_LABELS } from "@streetdocmd/shared";
import type { ServiceType } from "@streetdocmd/shared";

// Shared by clinical-note/submit, nursing-encounter/submit and
// physio-encounter/submit — creating a follow-up is identical across all
// three professions, only the "which encounter table" column differs.
//
// If the completed booking isn't already attached to a care episode, one
// is created automatically here. Pass 3's premise is that setting a
// follow-up is itself the signal that this needs coordinated care, not
// just a one-off visit — a patient shouldn't need a provider to have
// separately remembered to click "start a care episode" first for
// continuity to work.
export async function createFollowUp(
  admin: any,
  {
    bookingId, patientId, providerId, followUpDate, followUpType, followUpReason,
    sourceEncounterColumn, sourceEncounterId,
  }: {
    bookingId: string;
    patientId: string;
    providerId: string;
    followUpDate: string;
    followUpType: string;
    followUpReason: string | null;
    sourceEncounterColumn: "clinical_note_id" | "nursing_encounter_id" | "physiotherapy_encounter_id";
    sourceEncounterId: string;
  }
): Promise<{ careEpisodeId: string; followUpId: string } | null> {
  const { data: booking } = await admin
    .from("bookings")
    .select("care_episode_id, service_type")
    .eq("id", bookingId)
    .single();
  if (!booking) return null;

  let careEpisodeId: string | null = booking.care_episode_id;

  if (!careEpisodeId) {
    const serviceLabel = (SERVICE_LABELS as Record<ServiceType, string>)[booking.service_type as ServiceType] ?? "visit";
    const { data: newEpisode } = await admin
      .from("care_episodes")
      .insert({
        patient_id: patientId,
        title: `Care following ${serviceLabel}`,
        created_by: providerId,
        lead_provider_id: providerId,
      })
      .select("id")
      .single();
    if (!newEpisode) return null;

    careEpisodeId = newEpisode.id;
    await admin.from("care_team_members").insert({ care_episode_id: careEpisodeId, provider_id: providerId, is_lead: true });
    await admin.from("bookings").update({ care_episode_id: careEpisodeId }).eq("id", bookingId);
  }

  const { data: followUp } = await admin
    .from("follow_ups")
    .insert({
      care_episode_id: careEpisodeId,
      patient_id: patientId,
      created_by: providerId,
      reason: followUpReason || null,
      follow_up_date: followUpDate,
      follow_up_type: followUpType || "clinical_review",
      continuing_provider_id: providerId,
      [sourceEncounterColumn]: sourceEncounterId,
    })
    .select("id")
    .single();
  if (!followUp) return null;

  await admin.from("care_tasks").insert({
    care_episode_id: careEpisodeId,
    description: followUpReason ? `Follow-up: ${followUpReason}` : "Follow-up visit",
    task_type: "follow_up",
    due_date: followUpDate,
    created_by: providerId,
  });

  return { careEpisodeId: careEpisodeId!, followUpId: followUp.id };
}

// If the booking being completed was itself created to fulfil a pending
// follow-up (bookings.follow_up_id), mark that follow-up completed too —
// otherwise a follow-up silently stays "booked" forever even once the
// visit that satisfies it has happened.
export async function completeFollowUpForBooking(admin: any, bookingId: string): Promise<void> {
  const { data: booking } = await admin.from("bookings").select("follow_up_id").eq("id", bookingId).single();
  if (!booking?.follow_up_id) return;
  await admin
    .from("follow_ups")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", booking.follow_up_id);
}
