// Mirrors provider-web's requiredDocTypes(): a degree certificate plus the
// practising licence for the provider's regulator must be on file before the
// application is ready for review.

export const PROVIDER_DOC_LABELS: Record<string, string> = {
  certificate: "Degree certificate",
  mdcn_licence: "MDCN licence",
  nmcn_licence: "NMCN licence",
  mrtb_licence: "MRTB licence",
  mlscn_licence: "MLSCN licence",
  nin: "NIN slip",
  passport: "Passport",
};

const LICENCE_DOC_BY_BODY: Record<string, string> = {
  MDCN: "mdcn_licence",
  NMCN: "nmcn_licence",
  MRTB: "mrtb_licence",
  MLSCN: "mlscn_licence",
};

const LICENCE_DOC_BY_PROFESSION: Record<string, string> = {
  doctor: "mdcn_licence",
  nurse: "nmcn_licence",
  physiotherapist: "mrtb_licence",
  lab_scientist: "mlscn_licence",
};

/** Required documents that are not yet uploaded. */
export function missingProviderDocs(
  provider: { license_body?: string | null; profession?: string | null },
  uploadedTypes: string[]
): string[] {
  const missing: string[] = [];
  if (!uploadedTypes.includes("certificate")) missing.push("certificate");

  const licenceDoc =
    LICENCE_DOC_BY_BODY[(provider.license_body ?? "").toUpperCase()] ??
    LICENCE_DOC_BY_PROFESSION[provider.profession ?? ""];
  const hasLicence = licenceDoc
    ? uploadedTypes.includes(licenceDoc)
    : uploadedTypes.some((t) => t.endsWith("_licence"));
  if (!hasLicence) missing.push(licenceDoc ?? "licence");

  return missing;
}

export function docLabel(type: string) {
  return PROVIDER_DOC_LABELS[type] ?? (type === "licence" ? "Practising licence" : type.replace(/_/g, " "));
}
