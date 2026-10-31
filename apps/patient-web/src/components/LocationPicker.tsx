"use client";
import { useState } from "react";
import { MapPin, Edit3, Loader2, Navigation, ArrowLeft } from "lucide-react";
import dynamic from "next/dynamic";
import { Button, Input, Notice, cx, focusRing } from "@/components/ds";
import { usePlaceSearch } from "@/lib/use-place-search";
import type { Place } from "@/lib/places";

const LiveMap = dynamic(() => import("./LiveMap"), { ssr: false });
const PinPicker = dynamic(() => import("./PinPicker"), { ssr: false });

type Coords = { lat: number; lng: number };
type Mode = "choice" | "current" | "manual" | "pin";
type GeoState = "idle" | "locating" | "denied";

// Shared by every booking flow (generic service, wellness, lab tests,
// preferred-provider) — was previously copy-pasted per flow as
// browser-geolocation-only. Now offers a real choice: use the device's
// current position, search for an address (suggestions appear as you type),
// or drop a pin for places no search knows. Every path converges on the same
// onReady(coords, address) callback the booking forms already expect.
export default function LocationPicker({
  onReady,
  onReset,
}: {
  onReady: (coords: Coords, address: string) => void;
  onReset?: () => void;
}) {
  const [mode, setMode] = useState<Mode>("choice");
  const [geoState, setGeoState] = useState<GeoState>("idle");
  const [confirmed, setConfirmed] = useState<{ coords: Coords; address: string } | null>(null);

  const [query, setQuery] = useState("");
  const [details, setDetails] = useState("");
  const [locating, setLocating] = useState(false);
  const [searchError, setSearchError] = useState("");
  const { results, searching, failed, noMatches, locate } = usePlaceSearch("/api/places", mode === "manual" ? query : "");

  function reset() {
    setMode("choice");
    setGeoState("idle");
    setConfirmed(null);
    setQuery("");
    setDetails("");
    setSearchError("");
    onReset?.();
  }

  function useCurrentLocation() {
    setMode("current");
    if (!navigator.geolocation) {
      setGeoState("denied");
      return;
    }
    setGeoState("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          if (data?.display_name) address = data.display_name;
        } catch {
          // keep the coordinate fallback
        }
        setConfirmed({ coords: { lat, lng }, address });
        onReady({ lat, lng }, address);
      },
      () => setGeoState("denied"),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  function choose(coords: Coords, address: string) {
    setConfirmed({ coords, address });
    onReady(coords, address);
  }

  async function pickResult(place: Place) {
    setLocating(true);
    setSearchError("");
    const found = await locate(place);
    setLocating(false);
    if (!found) { setSearchError("Couldn't get that address. Try another, or drop a pin on the map."); return; }
    choose({ lat: found.lat, lng: found.lng }, found.address);
  }

  // Search rarely knows house numbers here, so they're added by hand
  function saveDetails() {
    if (!confirmed) return;
    const extra = details.trim();
    onReady(confirmed.coords, extra ? `${extra}, ${confirmed.address}` : confirmed.address);
  }

  const heading = <h3 className="mb-3 text-[17px] font-bold text-navy">Where?</h3>;
  const pinTile = (
    <span className="grid h-[42px] w-[42px] flex-none place-items-center rounded-[14px] bg-sky text-brand">
      <MapPin size={20} aria-hidden />
    </span>
  );

  if (confirmed) {
    return (
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-[17px] font-bold text-navy">Where?</h3>
          <button type="button" onClick={reset} className={cx("text-[13px] font-bold text-accent rounded-sm", focusRing)}>
            Change
          </button>
        </div>
        <div className="mb-2.5 overflow-hidden rounded-[20px] border border-line">
          <LiveMap providerLat={null} providerLng={null} patientLat={confirmed.coords.lat} patientLng={confirmed.coords.lng} providerName="" height={150} />
        </div>
        <div className="flex items-center gap-3 rounded-[20px] border border-line bg-surface p-3.5">
          {pinTile}
          <div className="min-w-0 flex-1 text-ds-sm">
            <small className="block text-ds-xs text-muted">Visit address</small>
            <b className="line-clamp-2 font-semibold text-ink">{confirmed.address}</b>
          </div>
        </div>
        <Input wrapperClassName="mt-2.5" label={<>House number, street or landmark <span className="font-normal text-muted">(optional)</span></>}
          placeholder="e.g. No. 4, blue gate opposite the church" value={details}
          onChange={e => setDetails(e.target.value)} onBlur={saveDetails} maxLength={150} />
      </section>
    );
  }

  if (mode === "choice") {
    return (
      <section>
        {heading}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={useCurrentLocation}
            className={cx("flex flex-col items-start gap-3 rounded-[20px] border border-line bg-surface p-4 text-left hover:border-accent", focusRing)}
          >
            {pinTile}
            <span className="text-ds-sm font-bold text-ink">Use my current location</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={cx("flex flex-col items-start gap-3 rounded-[20px] border border-line bg-surface p-4 text-left hover:border-accent", focusRing)}
          >
            <span className="grid h-[42px] w-[42px] flex-none place-items-center rounded-[14px] bg-sky text-brand">
              <Edit3 size={20} aria-hidden />
            </span>
            <span className="text-ds-sm font-bold text-ink">Choose a different address</span>
          </button>
        </div>
      </section>
    );
  }

  if (mode === "current") {
    if (geoState === "locating") {
      return (
        <section>
          {heading}
          <div className="flex items-center gap-3 rounded-[20px] border border-line bg-surface p-4" role="status">
            <Loader2 size={22} className="animate-spin text-brand" aria-hidden />
            <p className="text-ds-sm font-semibold text-ink">Getting your location…</p>
          </div>
        </section>
      );
    }
    // denied
    return (
      <section>
        {heading}
        <Notice tone="danger" title="Location access denied.">
          Enable location in your browser settings, or choose a different address instead.
        </Notice>
        <div className="mt-3 flex gap-2">
          <Button onClick={useCurrentLocation}>Try again</Button>
          <Button variant="secondary" onClick={() => setMode("manual")}>Choose an address</Button>
        </div>
      </section>
    );
  }

  if (mode === "pin") {
    return (
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-[17px] font-bold text-navy">Where?</h3>
          <button type="button" onClick={() => setMode("manual")}
            className={cx("inline-flex items-center gap-1 text-[13px] font-bold text-accent rounded-sm", focusRing)}>
            <ArrowLeft size={13} aria-hidden /> Back to search
          </button>
        </div>
        <PinPicker onPick={choose} />
      </section>
    );
  }

  // mode === "manual"
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[17px] font-bold text-navy">Where?</h3>
        <button type="button" onClick={() => setMode("choice")}
          className={cx("inline-flex items-center gap-1 text-[13px] font-bold text-accent rounded-sm", focusRing)}>
          <ArrowLeft size={13} aria-hidden /> Back
        </button>
      </div>
      <label className="flex h-[54px] items-center gap-2.5 rounded-[18px] border-[1.5px] border-line bg-surface px-4 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-soft">
        <MapPin size={20} className="flex-none text-navy" aria-hidden />
        <input
          className="min-w-0 flex-1 bg-transparent text-ds-control text-ink outline-none placeholder:text-muted"
          placeholder="Street, area or landmark"
          aria-label="Search for an address"
          autoComplete="off"
          autoFocus
          value={query}
          onChange={e => { setQuery(e.target.value); setSearchError(""); }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (results[0]) pickResult(results[0]); } }}
        />
        {(searching || locating) && <Loader2 size={18} className="flex-none animate-spin text-muted" aria-hidden />}
      </label>

      {query.trim().length > 0 && query.trim().length < 3 && <p className="mt-2 text-ds-xs text-muted">Keep typing to see suggestions.</p>}
      {(failed || searchError) && <p role="alert" className="mt-2 text-ds-sm font-semibold text-danger">{searchError || "Couldn't search right now. Check your connection, or drop a pin on the map."}</p>}
      {noMatches && <p className="mt-2 text-ds-sm text-ink">We couldn&apos;t find that address. Try a nearby street or landmark, or drop a pin on the map.</p>}

      {results.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-[20px] border border-line bg-surface">
          {results.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => pickResult(r)}
              disabled={locating}
              className={cx("flex w-full items-start gap-2.5 border-b border-line p-3.5 text-left text-ds-sm text-ink last:border-b-0 hover:bg-page", focusRing)}
            >
              <MapPin size={16} className="mt-0.5 flex-none text-muted" aria-hidden />
              <span className="min-w-0">
                <b className="block truncate font-semibold">{r.label}</b>
                {r.detail && <small className="block truncate text-ds-xs text-muted">{r.detail}</small>}
              </span>
            </button>
          ))}
        </div>
      )}

      <button type="button" onClick={() => setMode("pin")}
        className={cx("mt-3 inline-flex items-center gap-1.5 rounded-sm text-ds-sm font-bold text-accent hover:underline", focusRing)}>
        <Navigation size={15} aria-hidden /> Can&apos;t find it? Drop a pin on the map
      </button>
    </section>
  );
}
