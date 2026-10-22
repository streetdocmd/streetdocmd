// Facility verification documents: which ones each facility type uploads,
// and the file rules. Client-safe (no server imports): the portal upload UI,
// the upload API and the admin review screens all read it.

export const FACILITY_DOCS_BUCKET = "facility-docs";
export const FACILITY_DOC_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
export const FACILITY_DOC_MIME_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
export const FACILITY_DOC_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export type FacilityDocType =
  | "cac_certificate"
  | "operating_licence"
  | "mlscn_accreditation"
  | "pcn_premises_licence"
  | "moh_facility_licence"
  | "other";

export interface FacilityDocSpec {
  type: FacilityDocType;
  label: string;
  description: string;
  required: boolean;
}

const CAC: FacilityDocSpec = {
  type: "cac_certificate",
  label: "CAC certificate",
  description: "Certificate of incorporation or business name registration from the Corporate Affairs Commission.",
  required: true,
};
const OPERATING: FacilityDocSpec = {
  type: "operating_licence",
  label: "Facility operating licence",
  description: "Your current operating licence or facility registration certificate.",
  required: true,
};
const OTHER: FacilityDocSpec = {
  type: "other",
  label: "Other supporting document",
  description: "Optional — anything else that helps us verify your facility.",
  required: false,
};

const TYPE_SPECIFIC: Record<string, FacilityDocSpec> = {
  lab: {
    type: "mlscn_accreditation",
    label: "MLSCN accreditation / lab licence",
    description: "Medical Laboratory Science Council of Nigeria accreditation or laboratory licence.",
    required: true,
  },
  pharmacy: {
    type: "pcn_premises_licence",
    label: "PCN premises licence",
    description: "Current premises licence from the Pharmacists Council of Nigeria.",
    required: true,
  },
  hospital: {
    type: "moh_facility_licence",
    label: "State Ministry of Health licence",
    description: "Facility licence or registration from your state Ministry of Health.",
    required: true,
  },
};

/** Every document a facility of this type can upload, required ones first. */
export function facilityDocSpecs(facilityType: string | null | undefined): FacilityDocSpec[] {
  const specific = TYPE_SPECIFIC[facilityType ?? ""];
  return [CAC, OPERATING, ...(specific ? [specific] : []), OTHER];
}

export function requiredFacilityDocTypes(facilityType: string | null | undefined): FacilityDocType[] {
  return facilityDocSpecs(facilityType).filter((s) => s.required).map((s) => s.type);
}

export function isAllowedFacilityDocType(facilityType: string | null | undefined, docType: string): docType is FacilityDocType {
  return facilityDocSpecs(facilityType).some((s) => s.type === docType);
}

/** Specs of required documents not yet uploaded. */
export function missingFacilityDocs(facilityType: string | null | undefined, uploadedTypes: string[]): FacilityDocSpec[] {
  const have = new Set(uploadedTypes);
  return facilityDocSpecs(facilityType).filter((s) => s.required && !have.has(s.type));
}

const ALL_LABELS: Record<string, string> = Object.fromEntries(
  [CAC, OPERATING, OTHER, ...Object.values(TYPE_SPECIFIC)].map((s) => [s.type, s.label])
);

export function facilityDocLabel(docType: string) {
  return ALL_LABELS[docType] ?? docType.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export interface FacilityDocument {
  id: string;
  document_type: string;
  file_name: string | null;
  uploaded_at: string;
}

/** True when the error means facility_documents doesn't exist yet (migration 052 not applied). */
export function isMissingTableError(err: { code?: string; message?: string } | null | undefined) {
  return !!err && (err.code === "42P01" || err.code === "PGRST205" || /facility_documents/.test(err.message ?? "") && /exist|schema cache/i.test(err.message ?? ""));
}
