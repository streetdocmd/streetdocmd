import type { ServiceType } from "../types/database";

export const SERVICE_LABELS: Record<ServiceType, string> = {
  general_consultation: "General Consultation",
  blood_pressure_check: "Blood Pressure Check",
  malaria_typhoid_test: "Malaria / Typhoid Test",
  wound_care: "Wound Care",
  elderly_review: "Elderly Review",
  nursing_care: "Nursing Care",
  custom_request: "Custom Request",
};

export const SERVICE_PRICES: Record<ServiceType, number> = {
  general_consultation: 8000,
  blood_pressure_check: 4000,
  malaria_typhoid_test: 5000,
  wound_care: 6000,
  elderly_review: 10000,
  nursing_care: 12000,
  custom_request: 8000,
};

export const SERVICE_DESCRIPTIONS: Record<ServiceType, string> = {
  general_consultation: "A doctor visits to assess your symptoms and provide treatment",
  blood_pressure_check: "Monitoring and assessment of your blood pressure at home",
  malaria_typhoid_test: "Rapid diagnostic test with same-day results",
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
