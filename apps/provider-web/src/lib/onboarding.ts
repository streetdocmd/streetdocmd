import { getPractitionerType, PROVIDER_AGREEMENT_VERSION } from "@streetdocmd/shared";

export const DOC_LABELS: Record<string, string> = {
  certificate: "University / Degree Certificate",
  mdcn_licence: "MDCN Practising Licence",
  nmcn_licence: "NMCN Practising Licence",
  mrtb_licence: "MRTB Practising Licence",
  mlscn_licence: "MLSCN Practising Licence",
  nin: "NIN",
  passport: "Passport",
};

/** Documents a provider of this specialty must have on file before review. */
export function requiredDocTypes(specialty: string): string[] {
  const practitionerType = getPractitionerType(specialty);
  return practitionerType ? ["certificate", practitionerType.licenceDocType] : ["certificate"];
}

export function missingDocTypes(specialty: string, uploadedTypes: string[]): string[] {
  return requiredDocTypes(specialty).filter(t => !uploadedTypes.includes(t));
}

export function hasCurrentAgreement(agreementVersion: string | null | undefined): boolean {
  return agreementVersion === PROVIDER_AGREEMENT_VERSION;
}

/**
 * Where an unverified provider belongs. Single source of truth for the
 * dashboard layout, the documents step and the pending screen, so they can
 * never bounce a provider between each other.
 *
 *  - rejected                         → pending (shows the reason + re-apply link)
 *  - under_review                     → pending
 *  - pending, documents/agreement missing → documents
 *  - pending, everything submitted    → pending
 */
export function onboardingRoute(provider: {
  verification_status: string;
  specialty: string;
  agreement_version?: string | null;
}, uploadedTypes: string[]): "/dashboard" | "/onboarding/documents" | "/onboarding/pending" {
  if (provider.verification_status === "verified") return "/dashboard";
  if (provider.verification_status !== "pending") return "/onboarding/pending";
  const complete = missingDocTypes(provider.specialty, uploadedTypes).length === 0
    && hasCurrentAgreement(provider.agreement_version);
  return complete ? "/onboarding/pending" : "/onboarding/documents";
}
