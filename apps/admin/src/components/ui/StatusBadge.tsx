type Tone = "neutral" | "warning" | "info" | "success" | "danger" | "purple" | "orange";

const TONES: Record<Tone, { pill: string; dot: string }> = {
  neutral: { pill: "bg-gray-50 text-gray-600 border-gray-200",       dot: "bg-gray-400" },
  warning: { pill: "bg-amber-50 text-amber-700 border-amber-200",    dot: "bg-amber-500" },
  info:    { pill: "bg-blue-50 text-blue-700 border-blue-200",       dot: "bg-blue-500" },
  success: { pill: "bg-green-50 text-green-700 border-green-200",    dot: "bg-green-500" },
  danger:  { pill: "bg-red-50 text-red-700 border-red-200",          dot: "bg-red-500" },
  purple:  { pill: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  orange:  { pill: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
};

/** Status → tone for every status value the admin console displays. */
const STATUS_TONE: Record<string, Tone> = {
  // verification / applications
  pending: "warning",
  under_review: "info",
  verified: "success",
  approved: "success",
  rejected: "danger",
  // bookings
  pending_payment: "warning",
  paid: "warning",
  provider_declined: "danger",
  accepted: "info",
  en_route: "purple",
  arrived: "purple",
  in_progress: "orange",
  completed: "success",
  cancelled: "danger",
  expired: "neutral",
  // payments / withdrawals
  successful: "success",
  failed: "danger",
  refunded: "neutral",
  processed: "success",
};

const LABELS: Record<string, string> = {
  pending: "Pending",
  under_review: "Under review",
  pending_payment: "Awaiting payment",
  provider_declined: "Provider declined",
  en_route: "En route",
  in_progress: "In progress",
};

export function statusLabel(status: string) {
  return LABELS[status] ?? status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export default function StatusBadge({
  status,
  label,
  tone,
  size = "sm",
}: {
  status: string;
  label?: string;
  tone?: Tone;
  size?: "sm" | "md";
}) {
  const t = TONES[tone ?? STATUS_TONE[status] ?? "neutral"];
  const sizing = size === "md" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap ${sizing} ${t.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} aria-hidden />
      {label ?? statusLabel(status)}
    </span>
  );
}
