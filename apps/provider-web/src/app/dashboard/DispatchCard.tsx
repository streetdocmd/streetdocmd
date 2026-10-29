"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, Clock, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { SERVICE_LABELS, formatNaira } from "@streetdocmd/shared";
import { Avatar, Button, Pill } from "@/components/ds";

interface DispatchRequest {
  id: string;
  booking_id: string;
  sent_at?: string;
  expires_at: string;
  distance_km?: number | null;
  eta_minutes?: number | null;
  bookings: {
    service_type: string;
    patient_address: string;
    fee: number;
    net_payout: number;
    notes: string | null;
    patient_lat?: number | null;
    patient_lng?: number | null;
    /** First name and age only until accepted; allergies because they affect safe care */
    patient?: { first_name: string; age: number | null; allergies: string[] } | null;
  } | null;
}

function useSecondsLeft(expiresAt: string) {
  const [secs, setSecs] = useState(() => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
  useEffect(() => {
    if (secs <= 0) return;
    const id = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secs]);
  return secs;
}

// The area part of an address: drop the house number and street
function area(address: string) {
  const parts = address.split(",").map(s => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(1, 3).join(", ") : address;
}

export default function DispatchCard({ request }: { request: DispatchRequest }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const secs = useSecondsLeft(request.expires_at);

  async function respond(response: "accepted" | "declined") {
    setLoading(response === "accepted" ? "accept" : "decline");
    const supabase = createClient();

    if (response === "accepted") {
      // Atomic RPC: sets dispatch.response, booking.status, booking.provider_id in one call
      const { error } = await supabase.rpc("accept_dispatch", { p_dispatch_id: request.id });
      if (error) { alert("Could not accept — the offer may have already been taken."); setLoading(null); return; }
      router.push(`/dashboard/active/${request.booking_id}`);
    } else {
      await supabase
        .from("dispatch_queue")
        .update({ response: "declined", responded_at: new Date().toISOString() })
        .eq("id", request.id);
      router.refresh();
    }
  }

  const booking = request.bookings;
  if (!booking) return null;
  const rawLabel = (SERVICE_LABELS as Record<string, string>)[booking.service_type] ?? booking.service_type;
  const serviceLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1).toLowerCase();
  const windowS = request.sent_at
    ? Math.max(1, Math.round((new Date(request.expires_at).getTime() - new Date(request.sent_at).getTime()) / 1000))
    : 120;
  const pct = Math.min(100, Math.round((secs / windowS) * 100));
  const who = booking.patient
    ? [booking.patient.first_name, booking.patient.age != null ? String(booking.patient.age) : null].filter(Boolean).join(", ")
    : "Patient";
  const allergies = booking.patient?.allergies?.filter(Boolean) ?? [];

  return (
    <div className="rounded-ds-lg border-2 border-teal-deep bg-surface p-4 shadow-[0_12px_26px_rgba(0,127,115,0.16)]">
      <div className="flex items-center justify-between">
        <Pill tone="info" icon={Bell}>New request</Pill>
        <span className={`inline-flex items-center gap-1.5 text-ds-sm font-extrabold tabular-nums ${secs <= 30 ? "text-danger" : "text-orange-700"}`}>
          <Clock size={16} aria-hidden /> {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")} left
        </span>
      </div>
      <div className="my-3 mb-3.5 h-1.5 overflow-hidden rounded bg-line" aria-hidden>
        <span className="block h-full rounded transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--teal), var(--teal-deep))" }} />
      </div>

      <div className="flex items-center gap-3">
        <Avatar name={booking.patient?.first_name ?? "Patient"} size="sm" />
        <div className="min-w-0 flex-1">
          <b className="block text-ds-control text-ink">{serviceLabel}</b>
          <span className="block truncate text-ds-sm text-muted">{who} · {area(booking.patient_address)}</span>
        </div>
      </div>

      <div className="my-3.5 grid grid-cols-2 gap-2">
        <div className="rounded-[14px] bg-page px-3 py-2.5">
          <small className="block text-ds-2xs font-bold uppercase tracking-[0.05em] text-muted">You receive</small>
          <b className="text-ds-control text-navy tabular-nums">{formatNaira(booking.net_payout)}</b>
        </div>
        <div className="rounded-[14px] bg-page px-3 py-2.5">
          <small className="block text-ds-2xs font-bold uppercase tracking-[0.05em] text-muted">Distance</small>
          <b className="text-ds-control text-navy tabular-nums">
            {request.distance_km != null ? `${request.distance_km.toFixed(1)} km` : "Nearby"}
          </b>
        </div>
        <div className="col-span-2 rounded-[14px] bg-page px-3 py-2.5">
          <small className="block text-ds-2xs font-bold uppercase tracking-[0.05em] text-muted">Reason</small>
          <b className="text-[13px] text-navy">{booking.notes || serviceLabel}</b>
        </div>
      </div>

      {allergies.length > 0 && (
        <p className="mb-3.5 flex items-start gap-2 rounded-[14px] bg-warn-bg px-3 py-2.5 text-ds-sm text-ink">
          <TriangleAlert size={16} className="mt-0.5 flex-none text-warn" aria-hidden />
          <span><b>Allergies:</b> {allergies.join(", ")}</span>
        </p>
      )}

      <div className="flex gap-2.5">
        <Button variant="secondary" className="flex-1" onClick={() => respond("declined")} disabled={loading !== null}>
          {loading === "decline" ? "Declining…" : "Decline"}
        </Button>
        <Button className="flex-[1.4]" onClick={() => respond("accepted")} disabled={loading !== null || secs <= 0}>
          {loading === "accept" ? "Accepting…" : "Accept visit"}
        </Button>
      </div>
      <p className="mt-2.5 text-center text-ds-xs text-muted">Full contact details appear after you accept.</p>
    </div>
  );
}
