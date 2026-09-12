"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SERVICE_LABELS, SERVICE_PRICES, formatNaira } from "@/lib/shared";
import type { ServiceType } from "@/lib/shared";
import FamilyMemberPicker from "./FamilyMemberPicker";
import SchedulePicker from "./SchedulePicker";
import LocationPicker from "@/components/LocationPicker";

export default function BookProviderClient({
  service,
  description,
  careEpisodeId,
  followUpId,
}: {
  service: ServiceType;
  description?: string;
  careEpisodeId?: string;
  followUpId?: string;
}) {
  const router = useRouter();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");
  const [familyMemberId, setFamilyMemberId] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [scheduleReady, setScheduleReady] = useState(true);

  const fee = SERVICE_PRICES[service];

  async function book() {
    if (!coords || !scheduleReady) return;
    setBooking(true);
    setError("");

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_type: service,
          patient_lat: coords.lat,
          patient_lng: coords.lng,
          patient_address: address,
          notes: description ?? null,
          care_episode_id: careEpisodeId ?? null,
          follow_up_id: followUpId ?? null,
          family_member_id: familyMemberId,
          scheduled_at: scheduledAt,
        }),
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        // Server returned a non-JSON body (e.g. a crash page) — fall through to the generic message below.
      }

      if (!res.ok) {
        setError(json?.error ?? `Could not create booking (${res.status}). Please try again.`);
        setBooking(false);
        return;
      }

      router.push(`/dashboard/book/payment/${json.booking_id}`);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setBooking(false);
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-5">
      {/* Service summary */}
      <div className="card p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-bold text-gray-900 text-lg">
              {(SERVICE_LABELS as Record<string, string>)[service]}
            </p>
            {description && (
              <p className="text-sm text-gray-500 mt-1 italic">"{description}"</p>
            )}
            {followUpId && (
              <p className="text-xs text-teal-700 mt-1">Follow-up pricing applies — discounted from the standard rate.</p>
            )}
          </div>
          <span className={followUpId ? "text-sm text-gray-400 line-through" : "text-lg font-bold text-blue-brand"}>
            {formatNaira(fee)}
          </span>
        </div>
      </div>

      {/* Who is this for */}
      {!followUpId && <FamilyMemberPicker onChange={setFamilyMemberId} />}

      {/* When */}
      {!followUpId && <SchedulePicker onChange={(v, ready) => { setScheduledAt(v); setScheduleReady(ready); }} />}

      {/* Location step */}
      <LocationPicker
        onReady={(c, a) => { setCoords(c); setAddress(a); }}
        onReset={() => { setCoords(null); setAddress(""); }}
      />

      {coords && (
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            onClick={book}
            disabled={booking || !scheduleReady}
            className="btn-primary w-full text-base py-3 flex justify-center"
          >
            {booking ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 mt-0.5" />
                {scheduledAt ? "Confirming your slot…" : "Finding your provider…"}
              </>
            ) : followUpId ? (
              "Book Follow-up"
            ) : scheduledAt ? (
              `Confirm Booking · ${formatNaira(fee)}`
            ) : (
              `Book Now · ${formatNaira(fee)}`
            )}
          </button>
          <p className="text-xs text-center text-gray-400">
            We'll match you with the nearest available provider. Payment due after confirmation.
          </p>
        </div>
      )}
    </div>
  );
}