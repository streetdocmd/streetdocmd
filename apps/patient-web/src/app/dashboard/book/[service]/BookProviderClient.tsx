"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SERVICE_LABELS, SERVICE_PRICES, formatNaira } from "@/lib/shared";
import type { ServiceType } from "@/lib/shared";

type GeoState = "idle" | "locating" | "ready" | "denied";

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
  const [geoState, setGeoState] = useState<GeoState>("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");

  const fee = SERVICE_PRICES[service];

  function getLocation() {
    if (!navigator.geolocation) {
      setGeoState("denied");
      return;
    }
    setGeoState("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });

        // Reverse geocode with Nominatim (OpenStreetMap, free)
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

  async function book() {
    if (!coords) return;
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

      {/* Location step */}
      {geoState === "idle" && (
        <div className="card p-6 text-center">
          <p className="text-4xl mb-3">📍</p>
          <p className="font-semibold text-gray-900 mb-1">Share your location</p>
          <p className="text-sm text-gray-500 mb-5">
            We use your location to find the nearest available provider.
          </p>
          <button onClick={getLocation} className="btn-primary w-full">
            Allow location access
          </button>
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
          <p className="text-sm text-red-500 mb-4">
            Please enable location in your browser settings and try again.
          </p>
          <button onClick={getLocation} className="btn-primary w-full">
            Try again
          </button>
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
            <button onClick={getLocation} className="text-xs text-blue-brand hover:underline shrink-0">
              Update
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            onClick={book}
            disabled={booking}
            className="btn-primary w-full text-base py-3 flex justify-center"
          >
            {booking ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 mt-0.5" />
                Finding your provider…
              </>
            ) : followUpId ? (
              "Book Follow-up"
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