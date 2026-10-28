"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Toggle } from "@/components/ds";
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
    <div>
      <div
        className="relative overflow-hidden rounded-[26px] p-[18px] text-white shadow-[0_16px_34px_rgba(0,127,115,0.25)]"
        style={{ background: "linear-gradient(140deg, var(--navy) 0%, var(--teal-deep) 100%)" }}
      >
        <span aria-hidden className="absolute -right-[70px] -top-[70px] h-[170px] w-[170px] rounded-full bg-white/[0.08]" />
        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[19px] font-bold text-white">{available ? "You are online" : "You are offline"}</h2>
            <p className="mt-0.5 text-[13px] text-teal-soft">
              {loading
                ? (available ? "Going offline…" : "Getting your location…")
                : available ? "Patients nearby can book you now" : "Hidden from patients until you switch on"}
            </p>
          </div>
          <Toggle
            checked={available}
            onChange={() => toggle()}
            label={available ? "Go offline" : "Go online"}
            disabled={loading}
            surface="dark"
          />
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-ds-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}
