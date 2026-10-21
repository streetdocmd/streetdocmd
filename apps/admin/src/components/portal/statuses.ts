import type { BadgeTone } from "./ui";

export const LAB_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  ordered:                     { label: "New order",            tone: "amber" },
  confirmed:                   { label: "Confirmed",            tone: "blue" },
  sample_collector_dispatched: { label: "Collector dispatched", tone: "indigo" },
  sample_collected:            { label: "Sample collected",     tone: "purple" },
  processing:                  { label: "Processing",           tone: "navy" },
  resulted:                    { label: "Resulted",             tone: "green" },
};

export const LAB_FLOW = ["ordered", "confirmed", "sample_collector_dispatched", "sample_collected", "processing", "resulted"];

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
