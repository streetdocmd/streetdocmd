// Client-safe helpers for the Facility Partner Platform Service Agreement
// acceptance record (facility_applications.agreement_* — migration 054).
// Server reads live in ./facility-agreement-server.ts.
import { FACILITY_AGREEMENT } from "@/lib/legal";

export const FACILITY_AGREEMENT_VERSION = FACILITY_AGREEMENT.version;

export interface FacilityAgreementRecord {
  applicationId: string;
  applicationStatus: string;
  facilityName: string;
  /** Pre-fills the authorised representative's name when (re-)accepting. */
  contactName: string | null;
  version: string | null;
  acceptedAt: string | null;
  acceptedBy: string | null;
  acceptedName: string | null;
}

export type AgreementState = "accepted" | "outdated" | "missing";

/** "accepted" = the current version was accepted; "outdated" = an older version was. */
export function agreementState(r: { version?: string | null; acceptedAt?: string | null } | null | undefined): AgreementState {
  if (!r?.acceptedAt || !r.version) return "missing";
  return r.version === FACILITY_AGREEMENT_VERSION ? "accepted" : "outdated";
}

export function formatAcceptedAt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos",
  }) + " WAT";
}
