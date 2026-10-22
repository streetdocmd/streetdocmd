import { PATIENT_TERMS, PRIVACY_POLICY } from "@/lib/legal";

// The versions every patient must have accepted / acknowledged. They come
// straight from the approved documents (single source of truth) — a new
// document version automatically re-prompts existing patients.
export const TERMS_VERSION = PATIENT_TERMS.version;
export const PRIVACY_VERSION = PRIVACY_POLICY.version;

// Exact wording the documents prescribe for the two separate checkboxes.
export const [TERMS_ACCEPTANCE_LABEL, PRIVACY_ACKNOWLEDGEMENT_LABEL] = PATIENT_TERMS.acceptanceLabels;

export type LegalAcceptanceState = {
  terms_version?: string | null;
  privacy_policy_version?: string | null;
};

export function needsLegalAcceptance(row: LegalAcceptanceState | null | undefined): boolean {
  if (!row) return false;
  return row.terms_version !== TERMS_VERSION || row.privacy_policy_version !== PRIVACY_VERSION;
}

/** e.g. "22 October 2026" */
export function formatLegalDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
}
