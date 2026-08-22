// Inlined from packages/shared — avoids workspace dependency resolution issues on Vercel

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = "patient" | "provider" | "admin";
export type VerificationStatus = "pending" | "under_review" | "verified" | "rejected";
export type BookingStatus = "pending" | "accepted" | "en_route" | "arrived" | "in_progress" | "completed" | "cancelled";
export type PaymentMethod = "card" | "bank_transfer" | "ussd" | "subscription_credit";
export type PaymentStatus = "pending" | "successful" | "failed" | "refunded";
export type ServiceType =
  | "general_consultation" | "wellness_check" | "wound_care" | "elderly_review"
  | "nursing_care" | "custom_request" | "physiotherapy_assessment" | "physiotherapy_session";
export type SubscriptionPlan = "basic" | "standard" | "premium" | "family";
export type SubscriptionStatus = "active" | "expired" | "cancelled" | "paused";
export type Profession = "doctor" | "nurse" | "physiotherapist" | "lab_scientist";

// ─── Constants ────────────────────────────────────────────────────────────────

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

export const PROFESSION_LABELS: Record<Profession, string> = {
  doctor: "Doctor",
  nurse: "Nurse",
  physiotherapist: "Physiotherapist",
  lab_scientist: "Medical Laboratory Scientist",
};

export const PLATFORM_COMMISSION_RATE = 0.2;
export const PROVIDER_ACCEPTANCE_WINDOW_SECONDS = 120;

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
  basic:    { name: "Basic",    price: 15000, visits: 2,  label: "₦15,000/month" },
  standard: { name: "Standard", price: 25000, visits: 4,  label: "₦25,000/month" },
  premium:  { name: "Premium",  price: 45000, visits: 8,  label: "₦45,000/month" },
  family:   { name: "Family",   price: 60000, visits: 12, label: "₦60,000/month" },
};

// ─── Utils ────────────────────────────────────────────────────────────────────

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("234")) return `+${cleaned}`;
  if (cleaned.startsWith("0")) return `+234${cleaned.slice(1)}`;
  return `+234${cleaned}`;
}

export function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getEtaMinutes(distanceKm: number): number {
  return Math.ceil((distanceKm / 20) * 60);
}

export function calculateCommission(fee: number, rate = 0.2): number {
  return Math.round(fee * rate);
}

export function calculateNetPayout(fee: number, rate = 0.2): number {
  return fee - calculateCommission(fee, rate);
}

export function formatRelativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
