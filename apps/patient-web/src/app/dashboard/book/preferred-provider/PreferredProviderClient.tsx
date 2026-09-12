"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import FamilyMemberPicker from "../[service]/FamilyMemberPicker";
import SchedulePicker from "../[service]/SchedulePicker";
import LocationPicker from "@/components/LocationPicker";

interface ProviderInfo {
  id: string;
  name: string;
  photo_url: string | null;
  specialty: string;
  profession: string;
  bio: string | null;
  rating: number;
  total_visits: number;
}

export default function PreferredProviderClient({ retargetBookingId }: { retargetBookingId: string | null }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [looking, setLooking] = useState(false);
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [error, setError] = useState("");
  const [familyMemberId, setFamilyMemberId] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [booking, setBooking] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [scheduleReady, setScheduleReady] = useState(true);

  async function lookupCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLooking(true);
    setError("");
    setProvider(null);
    try {
      const res = await fetch(`/api/providers/by-code?code=${encodeURIComponent(code.trim())}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Provider not found"); setLooking(false); return; }
      setProvider(json);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    }
    setLooking(false);
  }

  async function confirmRetarget() {
    if (!provider) return;
    setBooking(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.rpc("retarget_booking", {
      p_booking_id: retargetBookingId,
      p_new_provider_id: provider.id,
    });
    setBooking(false);
    if (error) { setError(error.message); return; }
    router.push("/dashboard/bookings");
  }

  async function confirmNewBooking() {
    if (!provider || !coords || !scheduleReady) return;
    setBooking(true);
    setError("");
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targeted_provider_id: provider.id,
          patient_lat: coords.lat,
          patient_lng: coords.lng,
          patient_address: address,
          family_member_id: familyMemberId,
          scheduled_at: scheduledAt,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Could not create booking. Please try again."); setBooking(false); return; }
      router.push(`/dashboard/book/payment/${json.booking_id}`);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setBooking(false);
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-5">
      {!provider ? (
        <form onSubmit={lookupCode} className="card p-5 space-y-4">
          <label className="label">Provider code</label>
          <input
            className="input uppercase tracking-widest text-center text-lg font-semibold"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="e.g. 7K2PXQ"
            maxLength={6}
            required
          />
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
          )}
          <button type="submit" disabled={looking} className="btn-primary w-full">
            {looking ? "Looking up…" : "Find Provider"}
          </button>
        </form>
      ) : (
        <>
          <div className="card p-5 flex items-start gap-4">
            {provider.photo_url ? (
              <img src={provider.photo_url} alt={provider.name} className="w-16 h-16 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-brand flex items-center justify-center font-bold text-xl shrink-0">
                {provider.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-gray-900">{provider.name}</p>
              <p className="text-sm text-gray-500">{provider.specialty}</p>
              <p className="text-xs text-gray-400 mt-1">
                {provider.rating > 0 ? `★ ${provider.rating.toFixed(1)}` : "New provider"} · {provider.total_visits} visits
              </p>
              {provider.bio && <p className="text-sm text-gray-600 mt-2">{provider.bio}</p>}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
          )}

          {retargetBookingId ? (
            <button onClick={confirmRetarget} disabled={booking} className="btn-primary w-full text-base py-3">
              {booking ? "Sending request…" : `Request ${provider.name}`}
            </button>
          ) : (
            <>
              <FamilyMemberPicker onChange={setFamilyMemberId} />
              <SchedulePicker onChange={(v, ready) => { setScheduledAt(v); setScheduleReady(ready); }} />

              <LocationPicker
                onReady={(c, a) => { setCoords(c); setAddress(a); }}
                onReset={() => { setCoords(null); setAddress(""); }}
              />

              {coords && (
                <div className="space-y-4">
                  <button onClick={confirmNewBooking} disabled={booking || !scheduleReady} className="btn-primary w-full text-base py-3">
                    {booking ? "Sending request…" : `Book Appointment with ${provider.name}`}
                  </button>
                  <p className="text-xs text-center text-gray-400">
                    {provider.name} will be notified and can accept or decline. Payment due before dispatch.
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
