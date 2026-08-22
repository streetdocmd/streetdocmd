import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";

const VALID_COLUMNS = new Set([
  "referral_reason", "subjective_assessment", "pain_symptoms", "objective_assessment",
  "functional_measurements", "professional_assessment", "intervention", "patient_response",
  "progress", "home_program", "next_session_plan", "follow_up_date",
]);

export async function POST(req: NextRequest) {
  const admin = createAdminSupabase();
  const { encounterId, bookingId, encounterData, patientId, providerId } = await req.json();

  if (!encounterId || !bookingId) {
    return NextResponse.json({ error: "missing encounterId or bookingId" }, { status: 400 });
  }

  if (providerId) {
    const { data: provider } = await admin.from("providers").select("profession").eq("id", providerId).single();
    if (provider && provider.profession !== "physiotherapist") {
      return NextResponse.json({ error: "Only physiotherapists can submit a physiotherapy encounter" }, { status: 403 });
    }
  }

  const safeData = Object.fromEntries(
    Object.entries(encounterData ?? {}).filter(([k]) => VALID_COLUMNS.has(k))
  );

  const now = new Date().toISOString();
  const { error: encounterError } = await admin
    .from("physiotherapy_encounters")
    .update({ ...safeData, status: "submitted", submitted_at: now, updated_at: now })
    .eq("id", encounterId);

  if (encounterError) return NextResponse.json({ error: encounterError.message }, { status: 500 });

  // Complete the booking and credit the provider's wallet — same idempotent
  // pattern as the doctor's clinical-note/submit route.
  const { data: completedBooking, error: completeError } = await admin
    .from("bookings")
    .update({ status: "completed", completed_at: now })
    .eq("id", bookingId)
    .neq("status", "completed")
    .select("provider_id, net_payout")
    .single();

  if (!completeError && completedBooking?.net_payout) {
    await admin.rpc("increment_wallet", {
      p_provider_id: completedBooking.provider_id,
      p_amount: completedBooking.net_payout,
    });
  }

  if (patientId) {
    const { data: provider } = providerId
      ? await admin.from("providers").select("name, credentials").eq("id", providerId).single()
      : { data: null };
    const providerName = provider ? `${provider.name}${provider.credentials ? ` (${provider.credentials})` : ""}` : "Physiotherapist";

    await admin.from("visit_summaries").insert({
      physiotherapy_encounter_id: encounterId,
      patient_id: patientId,
      visit_date: now.split("T")[0],
      provider_name: providerName,
      reason_for_visit: safeData.referral_reason ?? "Physiotherapy session",
      what_was_done: (safeData.intervention as any)?.performed?.length
        ? `The physiotherapist performed: ${(safeData.intervention as any).performed.join(", ").replace(/_/g, " ")}.`
        : "The physiotherapist assessed and treated you during this visit.",
      recommendations: (safeData.home_program as any)?.notes ?? null,
      follow_up_date: safeData.follow_up_date ?? null,
      visible_to_patient: true,
    });
  }

  return NextResponse.json({ ok: true });
}
