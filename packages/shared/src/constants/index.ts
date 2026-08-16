import type { ServiceType } from "../types/database";

export const SERVICE_LABELS: Record<ServiceType, string> = {
  general_consultation: "General Consultation",
  wellness_check: "Wellness Check",
  wound_care: "Wound Care",
  elderly_review: "Elderly Review",
  nursing_care: "Nursing Care",
  custom_request: "Custom Request",
};

export const SERVICE_PRICES: Record<ServiceType, number> = {
  general_consultation: 8000,
  wellness_check: 5000,
  wound_care: 6000,
  elderly_review: 10000,
  nursing_care: 12000,
  custom_request: 8000,
};

export const SERVICE_DESCRIPTIONS: Record<ServiceType, string> = {
  general_consultation: "A doctor visits to assess your symptoms and provide treatment",
  wellness_check: "Annual check-up investigations — blood tests, urinalysis, and routine screening panels",
  wound_care: "Professional cleaning, dressing, and management of wounds",
  elderly_review: "Comprehensive health assessment for elderly patients",
  nursing_care: "Professional nursing care and procedures at home",
  custom_request: "Describe your specific medical need",
};

export const PLATFORM_COMMISSION_RATE = 0.2; // 20%

export const PROVIDER_ACCEPTANCE_WINDOW_SECONDS = 120; // 2 minutes

export const BOOKING_STATUS_LABELS = {
  pending: "Finding Provider",
  accepted: "Provider Assigned",
  en_route: "Provider En Route",
  arrived: "Provider Arrived",
  in_progress: "Visit in Progress",
  completed: "Visit Completed",
  cancelled: "Cancelled",
};

export const VERIFICATION_STATUS_LABELS = {
  pending: "Pending Submission",
  under_review: "Under Review",
  verified: "Verified",
  rejected: "Rejected",
};

export const SUBSCRIPTION_PLANS = {
  basic: { name: "Basic", price: 15000, visits: 2, label: "₦15,000/month" },
  standard: { name: "Standard", price: 25000, visits: 4, label: "₦25,000/month" },
  premium: { name: "Premium", price: 45000, visits: 8, label: "₦45,000/month" },
  family: { name: "Family", price: 60000, visits: 12, label: "₦60,000/month" },
};

// ─── Provider specialties & credential verification ────────────────────────
//
// Single source of truth for what an individual (home-visit) provider can
// register as, and what each one needs to be verified against. This
// replaces specialty string-matching (e.g. `specialty.startsWith("Medical
// Doctor")`) that used to be duplicated across registration, document
// upload, and profile display.
//
// These are the exact labels already stored in providers.specialty in
// production — do not rename existing entries, only add new ones, or
// existing provider rows will silently stop matching.
//
// Pharmacists are deliberately not an individual specialty here — a
// pharmacy only registers as an entity (see the facility registration
// flow); there is no individual/self-registered pharmacist path.

export const SPECIALTIES = [
  "Medical Doctor (General)",
  "Medical Doctor (Specialist)",
  "Registered Nurse",
  "Physiotherapist",
  "Medical Laboratory Scientist",
] as const;

export interface PractitionerTypeConfig {
  licenseBody: string;
  licenseLabel: string;
  licenceDocType: string;
  licenceDocLabel: string;
  /** Can this profession also be registered by an admin as affiliated with
   *  a hospital, in addition to registering independently? */
  allowsAffiliation: boolean;
  /** Must this practitioner also declare which field they specialize in
   *  (e.g. "Cardiology")? Only Medical Doctor (Specialist) today. */
  requiresSpecialistField?: boolean;
}

export const PRACTITIONER_TYPES: Record<string, PractitionerTypeConfig> = {
  "Medical Doctor (General)": {
    licenseBody: "MDCN",
    licenseLabel: "MDCN Registration Number",
    licenceDocType: "mdcn_licence",
    licenceDocLabel: "MDCN Medical Licence",
    allowsAffiliation: false,
  },
  "Medical Doctor (Specialist)": {
    licenseBody: "MDCN",
    licenseLabel: "MDCN Registration Number",
    licenceDocType: "mdcn_licence",
    licenceDocLabel: "MDCN Medical Licence",
    allowsAffiliation: false,
    requiresSpecialistField: true,
  },
  "Registered Nurse": {
    licenseBody: "NMCN",
    licenseLabel: "NMCN Registration Number",
    licenceDocType: "nmcn_licence",
    licenceDocLabel: "NMCN Nursing Licence",
    allowsAffiliation: false,
  },
  "Physiotherapist": {
    licenseBody: "MRTB",
    licenseLabel: "MRTB Registration Number",
    licenceDocType: "mrtb_licence",
    licenceDocLabel: "MRTB Practising Licence",
    allowsAffiliation: true,
  },
  "Medical Laboratory Scientist": {
    licenseBody: "MLSCN",
    licenseLabel: "MLSCN Registration Number",
    licenceDocType: "mlscn_licence",
    licenceDocLabel: "MLSCN Practising Licence",
    allowsAffiliation: true,
  },
};

export function getPractitionerType(specialty: string): PractitionerTypeConfig | null {
  return PRACTITIONER_TYPES[specialty] ?? null;
}
