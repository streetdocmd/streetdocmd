"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/shared";
import FamilyMemberPicker from "../[service]/FamilyMemberPicker";
import SchedulePicker from "../[service]/SchedulePicker";
import LocationPicker from "@/components/LocationPicker";

interface WellnessPackage {
  id: string;
  name: string;
  price: number;
  description: string | null;
  included_tests: { test_name: string; test_code?: string }[];
}

export default function WellnessPackagePicker({ packages }: { packages: WellnessPackage[] }) {
  const router = useRouter();
  const [packageId, setPackageId] = useState<string | null>(packages[0]?.id ?? null);
  const [familyMemberId, setFamilyMemberId] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [scheduleReady, setScheduleReady] = useState(true);

  const selectedPackage = packages.find(p => p.id === packageId) ?? null;

  async function book() {
    if (!coords || !packageId || !scheduleReady) return;
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
          scheduled_at: scheduledAt,
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
          <SchedulePicker onChange={(v, ready) => { setScheduledAt(v); setScheduleReady(ready); }} />

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
