import type { BadgeTone } from "./ui";
import { INVESTIGATION_STATUS, type StatusTone } from "@/lib/investigation-status";

// Lab orders use the shared investigation statuses (migration 067)
const TONE: Record<StatusTone, BadgeTone> = { ok: "green", warn: "amber", bad: "red", info: "blue", idle: "gray", teal: "navy" };
export const LAB_STATUS: Record<string, { label: string; tone: BadgeTone }> = Object.fromEntries(
  Object.entries(INVESTIGATION_STATUS).map(([k, v]) => [k, { label: v.label, tone: TONE[v.tone] }]),
);
// Labs read these from their own point of view
LAB_STATUS.lab_requested = { label: "New request", tone: "amber" };
LAB_STATUS.lab_accepted = { label: "Accepted", tone: "blue" };
LAB_STATUS.results_uploaded = { label: "Results sent", tone: "green" };
LAB_STATUS.doctor_review_pending = { label: "Results sent", tone: "green" };

/** The lab's next step from each status, and the status it leads to */
export const LAB_NEXT: Record<string, { to: string; action: string; needs?: "schedule" | "collection" }> = {
  lab_accepted: { to: "collection_scheduled", action: "Book the collection", needs: "schedule" },
  collection_scheduled: { to: "sample_collected", action: "Record the collection", needs: "collection" },
  sample_collected: { to: "received_at_lab", action: "Mark received at the lab" },
  in_transit: { to: "received_at_lab", action: "Mark received at the lab" },
  received_at_lab: { to: "analysis_in_progress", action: "Start analysis" },
};

export const PHARMACY_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  sent:            { label: "New order",        tone: "amber" },
  pending_payment: { label: "Awaiting payment", tone: "gray" },
  confirmed:       { label: "Paid · ready",     tone: "blue" },
  dispensing:      { label: "Dispensing",       tone: "indigo" },
  dispatched:      { label: "Out for delivery", tone: "purple" },
  delivered:       { label: "Delivered",        tone: "green" },
  cancelled:       { label: "Cancelled",        tone: "red" },
  expired:         { label: "Expired",          tone: "gray" },
};

export const PHARMACY_FLOW = ["sent", "pending_payment", "confirmed", "dispensing", "dispatched", "delivered"];

export const REFERRAL_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  pending:      { label: "New",          tone: "amber" },
  acknowledged: { label: "Acknowledged", tone: "blue" },
  in_progress:  { label: "Patient arrived", tone: "indigo" },
  completed:    { label: "Completed",    tone: "green" },
  cancelled:    { label: "Cancelled",    tone: "gray" },
};

export const URGENCY: Record<string, { label: string; tone: BadgeTone }> = {
  emergency: { label: "Emergency", tone: "red" },
  urgent:    { label: "Urgent",    tone: "amber" },
  routine:   { label: "Routine",   tone: "gray" },
};
