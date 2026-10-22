// Server-only: reads the signed-in facility's Agreement acceptance record.
import { createAdminSupabase } from "@/lib/supabase-server";
import type { FacilityAgreementRecord } from "./facility-agreement";

/**
 * The acceptance record on the user's LATEST facility application (the one
 * that governs their portal access), or null when they have none. Ownership
 * is by facility_applications.user_id — pass only an id Supabase Auth verified.
 *
 * Kept as its own query so a missing column (migration 054 not applied yet)
 * only hides the agreement prompt instead of breaking the portal.
 */
export async function getFacilityAgreementRecord(userId: string): Promise<FacilityAgreementRecord | null> {
  const { data, error } = await createAdminSupabase()
    .from("facility_applications")
    .select("id, status, name, contact_person_name, agreement_version, agreement_accepted_at, agreement_accepted_by, agreement_accepted_name")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(
      /agreement_/i.test(error.message)
        ? "facility agreement: agreement columns missing on facility_applications — apply migration 054_facility_agreement_acceptance.sql:"
        : "facility agreement: could not load acceptance record:",
      error
    );
    return null;
  }
  if (!data) return null;
  return {
    applicationId: data.id,
    applicationStatus: data.status,
    facilityName: data.name,
    contactName: data.contact_person_name ?? null,
    version: data.agreement_version ?? null,
    acceptedAt: data.agreement_accepted_at ?? null,
    acceptedBy: data.agreement_accepted_by ?? null,
    acceptedName: data.agreement_accepted_name ?? null,
  };
}
