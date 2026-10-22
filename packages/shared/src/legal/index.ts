import type { LegalDocument } from "./types";
import { PRIVACY_POLICY } from "./privacy-policy";
import { PATIENT_TERMS } from "./patient-terms";
import { PROVIDER_AGREEMENT } from "./provider-agreement";
import { FACILITY_AGREEMENT } from "./facility-agreement";

export type { LegalBlock, LegalSection, LegalDocument } from "./types";
export { PRIVACY_POLICY, PATIENT_TERMS, PROVIDER_AGREEMENT, FACILITY_AGREEMENT };

export const LEGAL_DOCUMENTS: Record<LegalDocument["slug"], LegalDocument> = {
  "privacy-policy": PRIVACY_POLICY,
  "patient-terms": PATIENT_TERMS,
  "provider-agreement": PROVIDER_AGREEMENT,
  "facility-agreement": FACILITY_AGREEMENT,
};

/** Public URLs of each document on the landing site (the canonical, linkable copies). */
export const LEGAL_SITE = "https://streetdocmd.com";
export const LEGAL_PATHS: Record<LegalDocument["slug"], string> = {
  "privacy-policy": "/privacy",
  "patient-terms": "/terms",
  "provider-agreement": "/provider-agreement",
  "facility-agreement": "/facility-agreement",
};
export const legalUrl = (slug: LegalDocument["slug"]) => `${LEGAL_SITE}${LEGAL_PATHS[slug]}`;
