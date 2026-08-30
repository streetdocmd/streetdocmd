import type { ServiceType, Profession, CareEpisodeStatus, CareTaskType, CareTaskStatus, FollowUpType, FollowUpStatus } from "../types/database";

export const SERVICE_LABELS: Record<ServiceType, string> = {
  general_consultation: "General Consultation",
  wellness_check: "Wellness Check",
  wound_care: "Wound Care",
  elderly_review: "Elderly Review",
  nursing_care: "Nursing Care",
  custom_request: "Custom Request",
  physiotherapy_assessment: "Physiotherapy Assessment",
  physiotherapy_session: "Physiotherapy Session",
};

export const SERVICE_PRICES: Record<ServiceType, number> = {
  general_consultation: 8000,
  wellness_check: 5000,
  wound_care: 6000,
  elderly_review: 10000,
  nursing_care: 12000,
  custom_request: 8000,
  physiotherapy_assessment: 15000,
  physiotherapy_session: 20000,
};

export const SERVICE_DESCRIPTIONS: Record<ServiceType, string> = {
  general_consultation: "A doctor visits to assess your symptoms and provide treatment",
  wellness_check: "Annual check-up investigations — blood tests, urinalysis, and routine screening panels",
  wound_care: "Professional cleaning, dressing, and management of wounds",
  elderly_review: "Comprehensive health assessment for elderly patients",
  nursing_care: "Professional nursing care and procedures at home",
  custom_request: "Describe your specific medical need",
  physiotherapy_assessment: "An initial physiotherapy evaluation to assess your condition and plan treatment",
  physiotherapy_session: "A follow-up physiotherapy treatment or rehabilitation session at home",
};

// Which profession fulfils each bookable service — used to route dispatch
// matching (bookings.profession) without the patient needing to know or
// care about professions directly.
export const SERVICE_PROFESSION: Record<ServiceType, Profession> = {
  general_consultation: "doctor",
  wellness_check: "doctor",
  custom_request: "doctor",
  wound_care: "nurse",
  elderly_review: "nurse",
  nursing_care: "nurse",
  physiotherapy_assessment: "physiotherapist",
  physiotherapy_session: "physiotherapist",
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

// ─── Profession (platform-level, coarse) ────────────────────────────────────
//
// `specialty` above is the human-facing practitioner type shown at
// registration and on profiles. `profession` is the coarse category that
// dispatch matching, clinical-action permissions, and encounter routing
// key off — every specialty maps to exactly one profession.

export const PROFESSIONS: Record<string, Profession> = {
  "Medical Doctor (General)": "doctor",
  "Medical Doctor (Specialist)": "doctor",
  "Registered Nurse": "nurse",
  "Physiotherapist": "physiotherapist",
  "Medical Laboratory Scientist": "lab_scientist",
};

export function getProfession(specialty: string): Profession {
  return PROFESSIONS[specialty] ?? "doctor";
}

export const PROFESSION_LABELS: Record<Profession, string> = {
  doctor: "Doctor",
  nurse: "Nurse",
  physiotherapist: "Physiotherapist",
  lab_scientist: "Medical Laboratory Scientist",
};

// Explicit capability grants per profession — a profession only gets a
// capability if it's listed here. A doctor does not automatically gain
// nurse/physio capabilities and vice versa; each is granted independently.
export type ProviderCapability =
  | "clinical_note"        // doctor's 14-step encounter
  | "nursing_encounter"
  | "physiotherapy_encounter"
  | "prescribe"
  | "order_labs"
  | "refer_to_hospital";

export const PROFESSION_CAPABILITIES: Record<Profession, ProviderCapability[]> = {
  doctor: ["clinical_note", "prescribe", "order_labs", "refer_to_hospital"],
  nurse: ["nursing_encounter"],
  physiotherapist: ["physiotherapy_encounter"],
  lab_scientist: [],
};

export function hasCapability(profession: Profession, capability: ProviderCapability): boolean {
  return PROFESSION_CAPABILITIES[profession]?.includes(capability) ?? false;
}

// Where a provider's in-progress/completed booking encounter lives, per
// profession. The doctor's route is untouched (`/dashboard/clinical-note`);
// nurse and physio get their own sibling routes.
export function getEncounterRoute(profession: Profession, bookingId: string): string {
  switch (profession) {
    case "nurse": return `/dashboard/nursing-note/${bookingId}`;
    case "physiotherapist": return `/dashboard/physio-note/${bookingId}`;
    default: return `/dashboard/clinical-note/${bookingId}`;
  }
}

// ─── Care Episodes (Pass 2) ──────────────────────────────────────────────

export const CARE_EPISODE_STATUS_LABELS: Record<CareEpisodeStatus, string> = {
  active: "Active",
  monitoring: "Monitoring",
  follow_up_due: "Follow-up Due",
  overdue: "Overdue",
  referred: "Referred",
  resolved: "Resolved",
  closed: "Closed",
  escalated: "Escalated",
};

// Auto-managed by the daily status-refresh job — a provider can still set
// referred/resolved/closed/escalated explicitly, but the job never picks
// those on its own and never reverts them.
export const CARE_EPISODE_AUTO_STATUSES: CareEpisodeStatus[] = [
  "active", "monitoring", "follow_up_due", "overdue",
];

export const CARE_TASK_TYPE_LABELS: Record<CareTaskType, string> = {
  medication: "Medication",
  lab: "Lab",
  monitoring: "Monitoring",
  physiotherapy: "Physiotherapy",
  wound_care: "Wound Care",
  follow_up: "Follow-up",
  other: "Other",
};

export const CARE_TASK_STATUS_LABELS: Record<CareTaskStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

// ─── Follow-ups (Pass 3) ─────────────────────────────────────────────────

export const FOLLOW_UP_TYPE_LABELS: Record<FollowUpType, string> = {
  home_visit: "Home Visit",
  virtual_consultation: "Virtual Consultation",
  lab_review: "Lab Review",
  clinical_review: "Clinical Review",
};

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  scheduled: "Scheduled",
  booked: "Booked",
  completed: "Completed",
  missed: "Missed",
  cancelled: "Cancelled",
};

// Which follow-up types are meaningful per profession — a physiotherapist
// wouldn't set "Lab Review", for instance.
export const FOLLOW_UP_TYPES_BY_PROFESSION: Record<Profession, FollowUpType[]> = {
  doctor: ["clinical_review", "home_visit", "virtual_consultation", "lab_review"],
  nurse: ["home_visit", "clinical_review", "virtual_consultation"],
  physiotherapist: ["home_visit", "virtual_consultation"],
  lab_scientist: ["lab_review"],
};
