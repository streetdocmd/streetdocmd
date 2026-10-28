"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navigation, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { getEncounterRoute, type Profession } from "@streetdocmd/shared";
import { Button } from "@/components/ds";

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStatus = "accepted" | "en_route" | "arrived" | "in_progress" | "completed";

// The visit's stages, as the design's step bar shows them
const STAGES: { status: BookingStatus; label: string; action: string }[] = [
  { status: "accepted",    label: "Accepted",   action: "I'm on my way" },
  { status: "en_route",    label: "On the way", action: "I've arrived" },
  { status: "arrived",     label: "Arrived",    action: "Start visit notes" },
  { status: "in_progress", label: "Visit",      action: "Continue visit notes" },
  { status: "completed",   label: "Complete",   action: "" },
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
  profession,
  directionsUrl,
}: {
  bookingId: string;
  currentStatus: BookingStatus;
  patientPhone: string;
  patientId: string;
  providerId: string;
  profession: Profession;
  /** Maps link to the patient's address */
  directionsUrl: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const encounterHref = getEncounterRoute(profession, bookingId);

  const [status, setStatus]   = useState<BookingStatus>(currentStatus);
  const [loading, setLoading] = useState(false);

  const stageIndex = STAGES.findIndex(s => s.status === status);
  const stage      = STAGES[stageIndex];
  const nextStatus = NEXT_STATUS[status];

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
      router.push(encounterHref);
      return;
    }

    setStatus(nextStatus);
    setLoading(false);
  }

  return (
    <>
      {/* Step bar */}
      <div className="-mt-1">
        <div className="flex gap-1.5" aria-hidden>
          {STAGES.map((s, i) => (
            <span key={s.status} className={`h-[5px] flex-1 rounded ${i <= stageIndex ? "bg-teal-deep" : "bg-line"}`} />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-ds-sm text-muted">Step {stageIndex + 1} of {STAGES.length}</span>
          <b className="text-ds-sm text-navy">{stage.label}</b>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="secondary" href={`tel:${patientPhone}`}><Phone size={18} aria-hidden /> Call</Button>
        {directionsUrl
          ? <Button variant="secondary" href={directionsUrl} target="_blank" rel="noopener noreferrer"><Navigation size={18} aria-hidden /> Directions</Button>
          : <Button variant="secondary" disabled><Navigation size={18} aria-hidden /> Directions</Button>}
      </div>

      {status !== "completed" && (
        <div className="sticky bottom-[76px] z-20 rounded-ds-lg border border-line bg-surface/95 p-3.5 shadow-ds backdrop-blur md:bottom-4">
          {status === "arrived" || status === "in_progress" ? (
            <Button href={encounterHref} block>{stage.action}</Button>
          ) : nextStatus ? (
            <Button block onClick={advance} disabled={loading}>{loading ? "Updating…" : stage.action}</Button>
          ) : null}
          <p className="mt-2 text-center text-ds-xs text-muted">Notes save as you go and become the patient&apos;s visit record.</p>
        </div>
      )}
    </>
  );
}
