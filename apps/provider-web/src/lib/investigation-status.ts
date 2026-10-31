// Investigation order statuses (migration 067), shared by the patient app,
// provider app, partner portals and admin console. The database function
// investigation_can_move() decides which moves are allowed; this file only
// names and groups them for screens.

export type InvestigationStatus =
  | "draft" | "awaiting_patient_approval" | "declined_by_patient"
  | "awaiting_payment" | "payment_failed" | "paid_awaiting_lab"
  | "lab_requested" | "lab_accepted" | "collection_scheduled" | "sample_collected"
  | "in_transit" | "received_at_lab" | "analysis_in_progress" | "results_uploaded"
  | "doctor_review_pending" | "reviewed" | "follow_up_required"
  | "completed" | "cancelled" | "exception";

export type StatusTone = "ok" | "warn" | "bad" | "info" | "idle" | "teal";

export const INVESTIGATION_STATUS: Record<InvestigationStatus, { label: string; tone: StatusTone }> = {
  draft:                     { label: "Not booked yet", tone: "idle" },
  awaiting_patient_approval: { label: "Waiting for the patient to pay", tone: "warn" },
  declined_by_patient:       { label: "Declined", tone: "idle" },
  awaiting_payment:          { label: "Awaiting payment", tone: "warn" },
  payment_failed:            { label: "Payment failed", tone: "bad" },
  paid_awaiting_lab:         { label: "Paid, finding a lab", tone: "info" },
  lab_requested:             { label: "Waiting for the lab", tone: "info" },
  lab_accepted:              { label: "Lab confirmed", tone: "info" },
  collection_scheduled:      { label: "Collection booked", tone: "info" },
  sample_collected:          { label: "Sample collected", tone: "info" },
  in_transit:                { label: "On the way to the lab", tone: "info" },
  received_at_lab:           { label: "Received by the lab", tone: "info" },
  analysis_in_progress:      { label: "Being analysed", tone: "info" },
  results_uploaded:          { label: "Results ready", tone: "ok" },
  doctor_review_pending:     { label: "Results ready, doctor reviewing", tone: "ok" },
  reviewed:                  { label: "Reviewed by your doctor", tone: "ok" },
  follow_up_required:        { label: "Follow up needed", tone: "warn" },
  completed:                 { label: "Completed", tone: "ok" },
  cancelled:                 { label: "Cancelled", tone: "idle" },
  exception:                 { label: "Needs attention", tone: "bad" },
};

export function statusOf(s: string) {
  return INVESTIGATION_STATUS[s as InvestigationStatus] ?? { label: s, tone: "idle" as StatusTone };
}

/** Results have been published (patient and doctor can see them) */
export const RESULT_STATUSES: InvestigationStatus[] = [
  "results_uploaded", "doctor_review_pending", "reviewed", "follow_up_required", "completed",
];

/** Before payment: the lab isn't involved yet */
export const PRE_LAB_STATUSES: InvestigationStatus[] = [
  "draft", "awaiting_patient_approval", "declined_by_patient", "awaiting_payment", "payment_failed", "paid_awaiting_lab",
];

/** The patient's timeline, in order. Statuses not listed map onto the nearest step. */
export const TIMELINE: { key: string; label: string; statuses: InvestigationStatus[] }[] = [
  { key: "paid", label: "Paid", statuses: ["paid_awaiting_lab"] },
  { key: "lab", label: "Lab confirmed", statuses: ["lab_requested", "lab_accepted"] },
  { key: "scheduled", label: "Collection booked", statuses: ["collection_scheduled"] },
  { key: "collected", label: "Sample collected", statuses: ["sample_collected", "in_transit"] },
  { key: "received", label: "At the lab", statuses: ["received_at_lab", "analysis_in_progress"] },
  { key: "results", label: "Results ready", statuses: ["results_uploaded", "doctor_review_pending", "reviewed", "follow_up_required", "completed"] },
];

export function timelineIndex(status: string): number {
  const i = TIMELINE.findIndex(t => (t.statuses as string[]).includes(status));
  return i;
}

export const NEXT_STEP_LABEL: Record<string, string> = {
  none: "No further action needed",
  treatment: "Treatment or prescription",
  repeat_test: "Repeat the test",
  referral: "Referral to a specialist or hospital",
  follow_up: "Follow up visit",
};

export const WINDOW_LABEL: Record<string, string> = {
  morning: "Morning, 8am to 12pm",
  afternoon: "Afternoon, 12pm to 4pm",
  evening: "Evening, 4pm to 7pm",
};
