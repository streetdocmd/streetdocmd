"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import FamilyMemberPicker from "../[service]/FamilyMemberPicker";

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

type GeoState = "idle" | "locating" | "ready" | "denied";

export default function PreferredProviderClient({ retargetBookingId }: { retargetBookingId: string | null }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [looking, setLooking] = useState(false);
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [error, setError] = useState("");
  const [familyMemberId, setFamilyMemberId] = useState<string | null>(null);
  const [geoState, setGeoState] = useState<GeoState>("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [booking, setBooking] = useState(false);

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

  function getLocation() {
    if (!navigator.geolocation) { setGeoState("denied"); return; }
    setGeoState("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          setAddress(data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        } catch {
          setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }
        setGeoState("ready");
      },
      () => setGeoState("denied"),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  async function confirmNewBooking() {
    if (!provider || !coords) return;
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

              {geoState === "idle" && (
                <div className="card p-6 text-center">
                  <p className="text-4xl mb-3">📍</p>
                  <p className="font-semibold text-gray-900 mb-1">Share your location</p>
                  <p className="text-sm text-gray-500 mb-5">We'll send this to your provider.</p>
                  <button onClick={getLocation} className="btn-primary w-full">Allow location access</button>
                </div>
              )}

              {geoState === "locating" && (
                <div className="card p-6 text-center">
                  <div className="w-10 h-10 border-4 border-blue-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">Getting your location…</p>
                </div>
              )}

              {geoState === "denied" && (
                <div className="card p-6 text-center border border-red-200 bg-red-50">
                  <p className="text-red-700 font-medium mb-2">Location access denied</p>
                  <button onClick={getLocation} className="btn-primary w-full">Try again</button>
                </div>
              )}

              {geoState === "ready" && coords && (
                <div className="space-y-4">
                  <div className="card p-4 flex items-start gap-3">
                    <span className="text-xl mt-0.5">📍</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 mb-0.5">Your location</p>
                      <p className="text-sm text-gray-700 leading-snug line-clamp-2">{address}</p>
                    </div>
                    <button onClick={getLocation} className="text-xs text-blue-brand hover:underline shrink-0">Update</button>
                  </div>
                  <button onClick={confirmNewBooking} disabled={booking} className="btn-primary w-full text-base py-3">
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
