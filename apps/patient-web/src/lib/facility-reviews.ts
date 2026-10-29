import type { SupabaseClient } from "@supabase/supabase-js";

export type FacilityType = "pharmacy" | "lab" | "hospital";

// What a patient rates for each kind of facility, and when it can be rated
export const RATEABLE: Record<FacilityType, {
  table: string;
  facilityKey: string;
  partner: string;
  doneStatus: string;
  noun: string;
  question: string;
}> = {
  pharmacy: {
    table: "prescription_orders", facilityKey: "pharmacy_partner_id", partner: "pharmacy_partners",
    doneStatus: "delivered", noun: "pharmacy", question: "How was your medicine order from",
  },
  lab: {
    table: "investigation_orders", facilityKey: "lab_partner_id", partner: "lab_partners",
    doneStatus: "resulted", noun: "lab", question: "How were your tests with",
  },
  hospital: {
    table: "hospital_referrals", facilityKey: "hospital_partner_id", partner: "hospital_partners",
    doneStatus: "completed", noun: "hospital", question: "How was your care at",
  },
};

/** "4.6 · 12 reviews" for a partner row, or null before its first review */
export function ratingSummary(p: { rating?: number | string | null; review_count?: number | null } | null | undefined) {
  const n = Number(p?.review_count ?? 0);
  if (!n) return null;
  return `★ ${Number(p?.rating ?? 0).toFixed(1)} · ${n} review${n === 1 ? "" : "s"}`;
}

export const isFacilityType = (v: unknown): v is FacilityType =>
  v === "pharmacy" || v === "lab" || v === "hospital";

/**
 * The patient's own finished order and its facility, or null. Reads with the
 * service role, so callers must pass the verified patient id.
 */
export async function loadRateableOrder(admin: SupabaseClient, type: FacilityType, orderId: string, patientId: string) {
  const cfg = RATEABLE[type];
  const { data } = await admin
    .from(cfg.table)
    .select(`id, status, patient_id, ${cfg.facilityKey}, ${cfg.partner}(name)`)
    .eq("id", orderId)
    .maybeSingle();
  const row = data as Record<string, any> | null;
  if (!row || row.patient_id !== patientId) return null;
  return {
    facilityId: row[cfg.facilityKey] as string,
    facilityName: (row[cfg.partner]?.name as string | undefined) ?? `the ${cfg.noun}`,
    done: row.status === cfg.doneStatus,
  };
}
