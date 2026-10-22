import { PATIENT_TERMS, PRIVACY_POLICY } from "@streetdocmd/shared";
import { supabase } from "./supabase";

// The versions every patient must have accepted / acknowledged, straight
// from the approved documents in @streetdocmd/shared (single source of
// truth, shared with patient-web). A new version re-prompts every patient.
export const TERMS_VERSION = PATIENT_TERMS.version;
export const PRIVACY_VERSION = PRIVACY_POLICY.version;

// Exact wording the documents prescribe for the two separate checkboxes.
export const TERMS_ACCEPTANCE_LABEL = PATIENT_TERMS.acceptanceLabels[0];
export const PRIVACY_ACKNOWLEDGEMENT_LABEL = PATIENT_TERMS.acceptanceLabels[1];

export type LegalAcceptanceContext = "signup_deferred" | "complete_profile" | "reaccept";

export type LegalAcceptanceRow = {
  terms_version?: string | null;
  terms_accepted_at?: string | null;
  privacy_policy_version?: string | null;
  privacy_acknowledged_at?: string | null;
};

export function needsLegalAcceptance(row: LegalAcceptanceRow | null | undefined): boolean {
  if (!row) return false;
  return row.terms_version !== TERMS_VERSION || row.privacy_policy_version !== PRIVACY_VERSION;
}

// Records acceptance of the Terms + acknowledgement of the Privacy Policy
// through the record_patient_legal_acceptance RPC (migration 053): the
// accepting account is the session's, the timestamp is database time (for
// 'signup_deferred', the server time the sign-up was submitted), and both
// consent_log rows are written in the same transaction. The phone's clock
// is never used.
export async function recordLegalAcceptance(
  context: LegalAcceptanceContext,
  versions: { terms: string; privacy: string } = { terms: TERMS_VERSION, privacy: PRIVACY_VERSION },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("record_patient_legal_acceptance", {
    p_terms_version: versions.terms,
    p_privacy_version: versions.privacy,
    p_context: context,
  });
  if (error) {
    console.warn("[legal] record_patient_legal_acceptance failed", error);
    return { ok: false, error: "We couldn't save your acceptance. Please try again." };
  }
  return { ok: true };
}

/** e.g. "22 October 2026" */
export function formatLegalDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const months = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
