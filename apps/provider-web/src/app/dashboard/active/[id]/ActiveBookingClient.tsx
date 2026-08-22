"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStatus = "accepted" | "en_route" | "arrived" | "in_progress" | "completed";

const STEPS: { status: BookingStatus; label: string; action: string }[] = [
  { status: "accepted",    label: "Request accepted",    action: "I'm on my way"  },
  { status: "en_route",   label: "En route to patient",  action: "I've arrived"   },
  { status: "arrived",    label: "Arrived at patient",   action: "Start visit"    },
  { status: "in_progress", label: "Visit in progress",   action: "Continue →"     },
  { status: "completed",  label: "Visit completed",      action: ""               },
];

const NEXT_STATUS: Partial<Record<BookingStatus, BookingStatus>> = {
  accepted:    "en_route",
  en_route:    "arrived",
  arrived:     "in_progress",
  in_progress: "completed",
};

const STATUS_FIELD: Partial<Record<BookingStatus, string>> = {
  arrived:   "arrived_at",
  completed: "completed_at",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ActiveBookingClient({
  bookingId,
  currentStatus,
  patientPhone,
}: {
  bookingId: string;
  currentStatus: BookingStatus;
  patientPhone: string;
  patientId: string;
  providerId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [status, setStatus]   = useState<BookingStatus>(currentStatus);
  const [loading, setLoading] = useState(false);

  const stepIndex   = STEPS.findIndex(s => s.status === status);
  const currentStep = STEPS[stepIndex];
  const nextStatus  = NEXT_STATUS[status];

  // ─── Advance (non-completion status transitions) ──────────────────────────
  // "arrived" hands off to the clinical note wizard, which is what actually
  // takes the visit through to "completed" (see api/clinical-note/submit).
  async function advance() {
    if (!nextStatus) return;

    setLoading(true);
    const now    = new Date().toISOString();
    const update: Record<string, string> = { status: nextStatus };
    const field  = STATUS_FIELD[nextStatus];
    if (field) update[field] = now;
    await supabase.from("bookings").update(update).eq("id", bookingId);

    if (nextStatus === "arrived") {
      router.push(`/dashboard/clinical-note/${bookingId}`);
      return;
    }

    setStatus(nextStatus);
    setLoading(false);
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Progress steps */}
      <div className="card p-5">
        <div className="space-y-3">
          {STEPS.filter(s => s.status !== "completed" || status === "completed").map((step, i) => {
            const idx    = STEPS.findIndex(s => s.status === status);
            const done   = i < idx;
            const active = i === idx;
            return (
              <div key={step.status} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  done   ? "bg-teal-brand text-white" :
                  active ? "bg-blue-brand text-white" :
                           "bg-gray-100 text-gray-400"
                }`}>
                  {done ? "✓" : i + 1}
                </div>
                <span className={`text-sm ${active ? "font-semibold text-gray-900" : done ? "text-gray-500" : "text-gray-300"}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Call patient */}
      <a href={`tel:${patientPhone}`} className="card p-4 flex items-center gap-3 hover:shadow-card-md transition-shadow">
        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-xl">📞</div>
        <div>
          <p className="font-semibold text-gray-900">Call patient</p>
          <p className="text-sm text-gray-500">{patientPhone}</p>
        </div>
      </a>

      {/* Continue Clinical Note (arrived or in_progress — provider navigated back) */}
      {(status === "arrived" || status === "in_progress") && (
        <a href={`/dashboard/clinical-note/${bookingId}`}
          className="w-full py-3 rounded-xl font-semibold text-white bg-teal-brand hover:bg-teal-700 transition-colors flex items-center justify-center gap-2">
          📋 Continue Clinical Note →
        </a>
      )}

      {/* Advance button (non-completion steps) */}
      {status !== "completed" && nextStatus && status !== "arrived" && status !== "in_progress" && (
        <button onClick={advance} disabled={loading}
          className="w-full py-3 rounded-xl font-semibold text-white transition-colors disabled:opacity-50 bg-blue-brand hover:bg-blue-700">
          {loading ? "Updating…" : currentStep.action}
        </button>
      )}

    </div>
  );
}
