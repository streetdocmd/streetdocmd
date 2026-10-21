"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radio } from "lucide-react";
import { createClient } from "@/lib/supabase";

function locationErrorMessage(err: unknown): string {
  const code = (err as GeolocationPositionError | undefined)?.code;
  if (code === 1) {
    return "Location permission is blocked. Allow location for this site in your browser settings, then try again — we only use it to match you with nearby patients.";
  }
  if (code === 3) {
    return "Finding your location took too long. Move somewhere with better signal (or turn on Wi-Fi) and try again.";
  }
  return "We couldn't get your location. Check that location services are on for this device and try again.";
}

export default function AvailabilityToggle({
  providerId,
  initialAvailable,
}: {
  providerId: string;
  initialAvailable: boolean;
}) {
  const router = useRouter();
  const [available, setAvailable] = useState(initialAvailable);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    if (loading) return;
    const next = !available;
    setLoading(true);
    setError("");

    const supabase = createClient();

    if (next) {
      // Going online — capture location first
      if (!navigator.geolocation) {
        setError("Your browser doesn't support location. Try Chrome or Safari on your phone.");
        setLoading(false);
        return;
      }

      let pos: GeolocationPosition;
      try {
        pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15_000,
          })
        );
      } catch (err) {
        setError(locationErrorMessage(err));
        setLoading(false);
        return;
      }

      const { error: updateErr } = await supabase.from("providers").update({
        available: true,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      }).eq("id", providerId);
      if (updateErr) {
        setError("Couldn't go online — please check your connection and try again.");
        setLoading(false);
        return;
      }
    } else {
      const { error: updateErr } = await supabase.from("providers").update({ available: false }).eq("id", providerId);
      if (updateErr) {
        setError("Couldn't go offline — please check your connection and try again.");
        setLoading(false);
        return;
      }
    }

    setAvailable(next);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className={`card p-4 sm:p-5 space-y-2 ${available ? "border-green-200" : ""}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${available ? "bg-green-50" : "bg-gray-100"}`}>
            <Radio size={20} className={available ? "text-green-online" : "text-gray-400"} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">{available ? "You're online" : "You're offline"}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading
                ? (available ? "Going offline…" : "Getting your location…")
                : available ? "Accepting home-visit requests near you" : "Not receiving requests"}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={available}
          aria-label={available ? "Go offline" : "Go online"}
          onClick={toggle}
          disabled={loading}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-brand focus-visible:ring-offset-2 disabled:opacity-50 ${
            available ? "bg-green-online" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition duration-200 ${
              available ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
