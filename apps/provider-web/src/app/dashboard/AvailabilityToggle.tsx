"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

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
  const [locError, setLocError] = useState("");

  async function toggle() {
    const next = !available;
    setLoading(true);
    setLocError("");

    const supabase = createClient();

    if (next) {
      // Going online — capture location first
      if (!navigator.geolocation) {
        setLocError("Geolocation is not supported by your browser.");
        setLoading(false);
        return;
      }

      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10_000,
          })
        );

        await supabase.from("providers").update({
          available: true,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }).eq("id", providerId);
      } catch {
        setLocError(
          "Location access is required to go online. Please allow location permission and try again."
        );
        setLoading(false);
        return;
      }
    } else {
      // Going offline
      await supabase.from("providers").update({ available: false }).eq("id", providerId);
    }

    setAvailable(next);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900">Availability</p>
          <p className={`text-sm mt-0.5 ${available ? "text-green-600" : "text-gray-400"}`}>
            {available ? "● Online — accepting requests" : "○ Offline — not receiving requests"}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={loading}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
            available ? "bg-teal-brand" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition duration-200 ${
              available ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
      {loading && (
        <p className="text-xs text-gray-400">
          {available ? "Going offline…" : "Getting your location…"}
        </p>
      )}
      {locError && (
        <p className="text-xs text-red-500">{locError}</p>
      )}
    </div>
  );
}