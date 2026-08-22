export type UserRole = "patient" | "provider" | "admin";

export type VerificationStatus = "pending" | "under_review" | "verified" | "rejected";

export type BookingStatus =
  | "pending"
  | "accepted"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

export type PaymentMethod = "card" | "bank_transfer" | "ussd" | "subscription_credit";

export type PaymentStatus = "pending" | "successful" | "failed" | "refunded";

export type ServiceType =
  | "general_consultation"
  | "wellness_check"
  | "wound_care"
  | "elderly_review"
  | "nursing_care"
  | "custom_request";

export type SubscriptionPlan = "basic" | "standard" | "premium" | "family";

export type SubscriptionStatus = "active" | "expired" | "cancelled" | "paused";

export interface User {
  id: string;
  phone: string;
  name: string;
  dob: string | null;
  gender: "male" | "female" | "other" | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  photo_url: string | null;
  blood_group: string | null;
  known_conditions: string[];
  current_medications: string[];
  allergies: string[];
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface FamilyMember {
  id: string;
  account_holder_id: string;
  name: string;
  dob: string | null;
  gender: "male" | "female" | "other" | null;
  relationship: string;
  blood_group: string | null;
  known_conditions: string[];
  current_medications: string[];
  allergies: string[];
  created_at: string;
}

export interface Provider {
  id: string;
  user_id: string;
  phone: string;
  name: string;
  photo_url: string | null;
  specialty: string;
  specialist_field: string | null;
  credentials: string;
  license_body: string | null;
  license_number: string | null;
  years_experience: number;
  bio: string | null;
  verification_status: VerificationStatus;
  badge_issued: boolean;
  rejection_reason: string | null;
  rating: number;
  total_visits: number;
  response_rate: number;
  completion_rate: number;
  available: boolean;
  working_hours_start: string | null;
  working_hours_end: string | null;
  service_radius_km: number;
  lat: number | null;
  lng: number | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  wallet_balance: number;
  created_at: string;
  updated_at: string;
}

export interface ProviderDocument {
  id: string;
  provider_id: string;
  document_type: "mdcn_licence" | "nmcn_licence" | "mrtb_licence" | "mlscn_licence" | "nin" | "passport" | "certificate";
  file_url: string;
  uploaded_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface Booking {
  id: string;
  patient_id: string;
  family_member_id: string | null;
  provider_id: string | null;
  service_type: ServiceType;
  status: BookingStatus;
  patient_lat: number;
  patient_lng: number;
  patient_address: string;
  notes: string | null;
  scheduled_at: string | null;
  accepted_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  fee: number;
  commission: number;
  net_payout: number;
  payment_status: PaymentStatus;
  dispatch_attempts: number;
  created_at: string;
  updated_at: string;
}

export interface Visit {
  id: string;
  booking_id: string;
  chief_complaint: string | null;
  history: string | null;
  examination_findings: string | null;
  diagnosis: string | null;
  treatment: string | null;
  follow_up_plan: string | null;
  follow_up_date: string | null;
  prescription_url: string | null;
  referral_url: string | null;
  photos: string[];
  created_at: string;
  updated_at: string;
}

export interface Prescription {
  id: string;
  visit_id: string;
  booking_id: string;
  provider_id: string;
  patient_id: string;
  drugs: PrescriptionDrug[];
  notes: string | null;
  pdf_url: string | null;
  created_at: string;
}

export interface PrescriptionDrug {
  name: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string | null;
}

export interface LabOrder {
  id: string;
  visit_id: string;
  booking_id: string;
  patient_id: string;
  provider_id: string;
  lab_partner_id: string;
  tests: string[];
  status: "ordered" | "sample_collected" | "processing" | "ready";
  results_url: string | null;
  ordered_at: string;
  results_at: string | null;
}

export interface Payment {
  id: string;
  booking_id: string;
  patient_id: string;
  amount: number;
  method: PaymentMethod;
  paystack_reference: string | null;
  status: PaymentStatus;
  created_at: string;
}

export interface Review {
  id: string;
  booking_id: string;
  patient_id: string;
  provider_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  patient_id: string;
  plan: SubscriptionPlan;
  start_date: string;
  end_date: string;
  visits_remaining: number;
  status: SubscriptionStatus;
  paystack_subscription_code: string | null;
  created_at: string;
}

export interface LabPartner {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string | null;
  referral_fee: number;
  active: boolean;
  created_at: string;
}

export interface VerificationLog {
  id: string;
  provider_id: string;
  admin_id: string;
  action: "approved" | "rejected" | "suspended" | "reinstated";
  notes: string | null;
  created_at: string;
}
