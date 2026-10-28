"use client";
import { useState } from "react";
import { MapPin, Edit3, Loader2, Search, ArrowLeft } from "lucide-react";
import { Button, Notice, cx, focusRing } from "@/components/ds";

type Coords = { lat: number; lng: number };
type Mode = "choice" | "current" | "manual";
type GeoState = "idle" | "locating" | "denied";

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

// Shared by every booking flow (generic service, wellness, lab tests,
// preferred-provider) — was previously copy-pasted per flow as
// browser-geolocation-only. Now offers a real choice: use the device's
// current position, or search and pick a different address. Either path
// converges on the same onReady(coords, address) callback the booking
// forms already expect.
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
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState("");

  function reset() {
    setMode("choice");
    setGeoState("idle");
    setConfirmed(null);
    setResults([]);
    setQuery("");
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

  async function searchAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");
    setResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
        { headers: { "Accept-Language": "en" } }
      );
      const data: SearchResult[] = await res.json();
      if (!data || data.length === 0) {
        setSearchError("No matching addresses found. Try being more specific.");
      } else {
        setResults(data);
      }
    } catch {
      setSearchError("Could not search right now. Check your connection and try again.");
    }
    setSearching(false);
  }

  function pickResult(r: SearchResult) {
    const coords = { lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
    setConfirmed({ coords, address: r.display_name });
    onReady(coords, r.display_name);
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
        {/* TODO(design): mini map above the address (the design shows a map preview with a pin). */}
        <div className="flex items-center gap-3 rounded-[20px] border border-line bg-surface p-3.5">
          {pinTile}
          <div className="min-w-0 flex-1 text-ds-sm">
            <small className="block text-ds-xs text-muted">Visit address</small>
            <b className="line-clamp-2 font-semibold text-ink">{confirmed.address}</b>
          </div>
        </div>
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
      <form onSubmit={searchAddress} className="flex gap-2">
        <label className="flex h-[54px] min-w-0 flex-1 items-center gap-2.5 rounded-[18px] border-[1.5px] border-line bg-surface px-4 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-soft">
          <MapPin size={20} className="flex-none text-navy" aria-hidden />
          <input
            className="min-w-0 flex-1 bg-transparent text-ds-control text-ink outline-none placeholder:text-muted"
            placeholder="e.g. 12 Allen Avenue, Ikeja, Lagos"
            aria-label="Search for an address"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </label>
        <Button type="submit" disabled={searching || !query.trim()} aria-label="Search" className="min-h-[54px] px-4">
          {searching ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Search size={18} aria-hidden />}
        </Button>
      </form>

      {searchError && <p className="mt-2 text-ds-sm font-semibold text-danger">{searchError}</p>}

      {results.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-[20px] border border-line bg-surface">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pickResult(r)}
              className={cx("flex w-full items-start gap-2.5 border-b border-line p-3.5 text-left text-ds-sm text-ink last:border-b-0 hover:bg-page", focusRing)}
            >
              <MapPin size={16} className="mt-0.5 flex-none text-muted" aria-hidden />
              <span className="line-clamp-2">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
