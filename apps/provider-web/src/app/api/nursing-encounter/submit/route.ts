import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";

const VALID_COLUMNS = new Set([
  "visit_reason", "patient_assessment", "vitals", "nursing_assessment",
  "intervention", "patient_education", "outcome", "escalation",
  "care_tasks", "follow_up_date", "follow_up_notes", "safeguarding_flag",
]);

export async function POST(req: NextRequest) {
  const admin = createAdminSupabase();
  const { encounterId, bookingId, encounterData, patientId, providerId } = await req.json();

  if (!encounterId || !bookingId) {
    return NextResponse.json({ error: "missing encounterId or bookingId" }, { status: 400 });
  }

  if (providerId) {
    const { data: provider } = await admin.from("providers").select("profession").eq("id", providerId).single();
    if (provider && provider.profession !== "nurse") {
      return NextResponse.json({ error: "Only nurses can submit a nursing encounter" }, { status: 403 });
    }
  }

  const safeData = Object.fromEntries(
    Object.entries(encounterData ?? {}).filter(([k]) => VALID_COLUMNS.has(k))
  );

  const now = new Date().toISOString();
  const { error: encounterError } = await admin
    .from("nursing_encounters")
    .update({ ...safeData, status: "submitted", submitted_at: now, updated_at: now })
    .eq("id", encounterId);

  if (encounterError) return NextResponse.json({ error: encounterError.message }, { status: 500 });

  if ((encounterData as any)?.safeguarding_flag && patientId) {
    await admin.from("safeguarding_alerts").insert({
      patient_id: patientId,
      provider_id: providerId,
      resolved: false,
      notes: "Raised via nursing encounter",
    });
  }

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

  // Patient-facing visit summary — mirrors the doctor flow's generate-summary
  // step, kept inline since a nursing encounter has no PDF/prescription to
  // generate.
  if (patientId) {
    const { data: provider } = providerId
      ? await admin.from("providers").select("name, credentials").eq("id", providerId).single()
      : { data: null };
    const providerName = provider ? `${provider.name}${provider.credentials ? ` (${provider.credentials})` : ""}` : "Nurse";

    await admin.from("visit_summaries").insert({
      nursing_encounter_id: encounterId,
      patient_id: patientId,
      visit_date: now.split("T")[0],
      provider_name: providerName,
      reason_for_visit: safeData.visit_reason ?? "Home nursing visit",
      what_was_done: (safeData.intervention as any)?.performed?.length
        ? `The nurse performed: ${(safeData.intervention as any).performed.join(", ").replace(/_/g, " ")}.`
        : "The nurse assessed and cared for you during this visit.",
      recommendations: (safeData.outcome as any)?.notes ?? null,
      follow_up_date: safeData.follow_up_date ?? null,
      visible_to_patient: true,
    });
  }

  return NextResponse.json({ ok: true });
}
