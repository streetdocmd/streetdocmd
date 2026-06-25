"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type BookingStatus = "accepted" | "en_route" | "arrived" | "in_progress" | "completed";

const STEPS: { status: BookingStatus; label: string; action: string }[] = [
  { status: "accepted",    label: "Request accepted",    action: "I'm on my way" },
  { status: "en_route",   label: "En route to patient",  action: "I've arrived" },
  { status: "arrived",    label: "Arrived at patient",   action: "Start visit" },
  { status: "in_progress", label: "Visit in progress",  action: "Complete visit" },
  { status: "completed",  label: "Visit completed",      action: "" },
];

const NEXT_STATUS: Partial<Record<BookingStatus, BookingStatus>> = {
  accepted: "en_route",
  en_route: "arrived",
  arrived: "in_progress",
  in_progress: "completed",
};

const STATUS_FIELD: Partial<Record<BookingStatus, string>> = {
  arrived: "arrived_at",
  completed: "completed_at",
};

interface VisitNotes {
  chief_complaint: string;
  diagnosis: string;
  treatment: string;
  follow_up_plan: string;
}

export default function ActiveBookingClient({
  bookingId,
  currentStatus,
  patientPhone,
}: {
  bookingId: string;
  currentStatus: BookingStatus;
  patientPhone: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<BookingStatus>(currentStatus);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<VisitNotes>({
    chief_complaint: "", diagnosis: "", treatment: "", follow_up_plan: "",
  });
  const [notesError, setNotesError] = useState("");

  const stepIndex = STEPS.findIndex(s => s.status === status);
  const currentStep = STEPS[stepIndex];
  const nextStatus = NEXT_STATUS[status];

  async function advance() {
    if (!nextStatus) return;

    if (status === "in_progress") {
      if (!notes.diagnosis.trim() || !notes.treatment.trim()) {
        setNotesError("Diagnosis and treatment are required to complete the visit.");
        return;
      }
    }

    setLoading(true);
    setNotesError("");
    const supabase = createClient();
    const now = new Date().toISOString();

    const update: Record<string, string> = { status: nextStatus };
    const timeField = STATUS_FIELD[nextStatus];
    if (timeField) update[timeField] = now;

    await supabase.from("bookings").update(update).eq("id", bookingId);

    if (nextStatus === "completed") {
      const hasNotes = Object.values(notes).some(v => v.trim());
      if (hasNotes) {
        await supabase.from("visits").insert({
          booking_id: bookingId,
          chief_complaint: notes.chief_complaint || null,
          diagnosis: notes.diagnosis || null,
          treatment: notes.treatment || null,
          follow_up_plan: notes.follow_up_plan || null,
        });
      }
      router.push("/dashboard");
      return;
    }

    setStatus(nextStatus);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      {/* Progress steps */}
      <div className="card p-5">
        <div className="space-y-3">
          {STEPS.filter(s => s.status !== "completed" || status === "completed").map((step, i) => {
            const idx = STEPS.findIndex(s => s.status === status);
            const done = i < idx;
            const active = i === idx;
            return (
              <div key={step.status} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  done ? "bg-teal-brand text-white" :
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
      <a
        href={`tel:${patientPhone}`}
        className="card p-4 flex items-center gap-3 hover:shadow-card-md transition-shadow"
      >
        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-xl">📞</div>
        <div>
          <p className="font-semibold text-gray-900">Call patient</p>
          <p className="text-sm text-gray-500">{patientPhone}</p>
        </div>
      </a>

      {/* Visit notes — show when in_progress */}
      {status === "in_progress" && (
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Visit notes</h3>
          <div>
            <label className="label">Chief complaint</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Patient's presenting complaint…"
              value={notes.chief_complaint}
              onChange={e => setNotes(n => ({ ...n, chief_complaint: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Diagnosis <span className="text-red-500">*</span></label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Clinical diagnosis…"
              value={notes.diagnosis}
              onChange={e => setNotes(n => ({ ...n, diagnosis: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Treatment given <span className="text-red-500">*</span></label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Medications, procedures, advice…"
              value={notes.treatment}
              onChange={e => setNotes(n => ({ ...n, treatment: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Follow-up plan</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Review in X days, referral, etc."
              value={notes.follow_up_plan}
              onChange={e => setNotes(n => ({ ...n, follow_up_plan: e.target.value }))}
            />
          </div>
          {notesError && <p className="text-red-600 text-sm">{notesError}</p>}
        </div>
      )}

      {/* Advance button */}
      {status !== "completed" && nextStatus && (
        <button
          onClick={advance}
          disabled={loading}
          className={`w-full py-3 rounded-xl font-semibold text-white transition-colors disabled:opacity-50 ${
            status === "in_progress" ? "bg-green-600 hover:bg-green-700" : "bg-blue-brand hover:bg-blue-700"
          }`}
        >
          {loading ? "Updating…" : currentStep.action}
        </button>
      )}
    </div>
  );
}