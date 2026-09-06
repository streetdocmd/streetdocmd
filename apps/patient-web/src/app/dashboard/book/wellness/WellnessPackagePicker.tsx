"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/shared";
import FamilyMemberPicker from "../[service]/FamilyMemberPicker";

interface WellnessPackage {
  id: string;
  name: string;
  price: number;
  description: string | null;
  included_tests: { test_name: string; test_code?: string }[];
}

type GeoState = "idle" | "locating" | "ready" | "denied";

export default function WellnessPackagePicker({ packages }: { packages: WellnessPackage[] }) {
  const router = useRouter();
  const [packageId, setPackageId] = useState<string | null>(packages[0]?.id ?? null);
  const [familyMemberId, setFamilyMemberId] = useState<string | null>(null);
  const [geoState, setGeoState] = useState<GeoState>("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");

  const selectedPackage = packages.find(p => p.id === packageId) ?? null;

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
    if (!coords || !packageId) return;
    setBooking(true);
    setError("");

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_type: "wellness_check",
          wellness_package_id: packageId,
          patient_lat: coords.lat,
          patient_lng: coords.lng,
          patient_address: address,
          family_member_id: familyMemberId,
        }),
      });

      let json: any = null;
      try { json = await res.json(); } catch { /* non-JSON error body */ }

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
      {/* Tier selection */}
      <div className="space-y-3">
        {packages.map(pkg => (
          <label
            key={pkg.id}
            className="card p-5 flex items-start gap-3 cursor-pointer has-[:checked]:border-blue-brand has-[:checked]:ring-1 has-[:checked]:ring-blue-brand"
          >
            <input
              type="radio"
              name="wellness_package"
              className="mt-1 accent-blue-brand"
              checked={packageId === pkg.id}
              onChange={() => setPackageId(pkg.id)}
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-bold text-gray-900">{pkg.name}</p>
                <span className="text-blue-brand font-bold">{formatNaira(pkg.price)}</span>
              </div>
              {pkg.description && <p className="text-sm text-gray-500 mt-1">{pkg.description}</p>}
              <p className="text-xs text-gray-400 mt-2">
                {pkg.included_tests.map(t => t.test_name).join(" · ")}
              </p>
            </div>
          </label>
        ))}
        {packages.length === 0 && (
          <div className="card p-8 text-center text-gray-400">No wellness packages available right now.</div>
        )}
      </div>

      {selectedPackage && (
        <>
          <FamilyMemberPicker onChange={setFamilyMemberId} />

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
                ) : (
                  `Book Now · ${formatNaira(selectedPackage.price)}`
                )}
              </button>
              <p className="text-xs text-center text-gray-400">
                We'll match you with the nearest available provider. Payment due after confirmation.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
