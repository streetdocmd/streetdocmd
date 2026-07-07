"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { SERVICE_LABELS, formatNaira } from "@streetdocmd/shared";

interface DispatchRequest {
  id: string;
  booking_id: string;
  expires_at: string;
  distance_km?: number | null;
  eta_minutes?: number | null;
  bookings: {
    service_type: string;
    patient_address: string;
    fee: number;
    net_payout: number;
    notes: string | null;
  } | null;
}

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [secs, setSecs] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    if (secs <= 0) return;
    const id = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secs]);

  const mins = Math.floor(secs / 60);
  const s = secs % 60;
  const urgent = secs <= 30;

  return (
    <span className={`font-mono font-bold text-lg tabular-nums ${urgent ? "text-red-600" : "text-amber-600"}`}>
      {mins}:{String(s).padStart(2, "0")}
    </span>
  );
}

export default function DispatchCard({ request }: { request: DispatchRequest }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);

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
  const serviceLabel = (SERVICE_LABELS as Record<string, string>)[booking.service_type] ?? booking.service_type;

  return (
    <div className="card p-5 border-l-4 border-blue-brand animate-pulse-border">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <span className="badge bg-blue-light text-blue-brand mb-1">New request</span>
          <h3 className="font-bold text-gray-900 text-lg">{serviceLabel}</h3>
          <p className="text-sm text-gray-500 mt-0.5">📍 {booking.patient_address}</p>
          {request.distance_km != null && (
            <p className="text-xs text-gray-400 mt-0.5">
              {request.distance_km.toFixed(1)} km away · ~{request.eta_minutes} min
            </p>
          )}
          {booking.notes && (
            <p className="text-sm text-gray-600 mt-1 italic">"{booking.notes}"</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-400 mb-1">Expires in</p>
          <Countdown expiresAt={request.expires_at} />
        </div>
      </div>

      <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 mb-4">
        <div className="text-center">
          <p className="text-xs text-gray-400">Service fee</p>
          <p className="font-semibold text-gray-900">{formatNaira(booking.fee)}</p>
        </div>
        <div className="w-px h-8 bg-gray-200" />
        <div className="text-center">
          <p className="text-xs text-gray-400">Your payout</p>
          <p className="font-bold text-teal-brand text-lg">{formatNaira(booking.net_payout)}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => respond("accepted")}
          disabled={loading !== null}
          className="btn-teal flex-1"
        >
          {loading === "accept" ? "Accepting…" : "Accept"}
        </button>
        <button
          onClick={() => respond("declined")}
          disabled={loading !== null}
          className="btn-danger flex-1"
        >
          {loading === "decline" ? "Declining…" : "Decline"}
        </button>
      </div>
    </div>
  );
}