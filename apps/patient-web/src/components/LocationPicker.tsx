"use client";
import { useState } from "react";
import { MapPin, Edit3, Loader2, Search, ArrowLeft } from "lucide-react";

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
        setSearchError("No matching addresses found — try being more specific.");
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

  if (confirmed) {
    return (
      <div className="card p-4 flex items-start gap-3">
        <MapPin size={18} className="text-blue-brand mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 mb-0.5">Visit address</p>
          <p className="text-sm text-gray-700 leading-snug line-clamp-2">{confirmed.address}</p>
        </div>
        <button onClick={reset} className="text-xs text-blue-brand hover:underline shrink-0">
          Change
        </button>
      </div>
    );
  }

  if (mode === "choice") {
    return (
      <div className="card p-5">
        <p className="font-semibold text-gray-900 mb-1">Where should the provider visit?</p>
        <p className="text-sm text-gray-500 mb-4">Choose how you'd like to set the visit address.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={useCurrentLocation}
            className="flex flex-col items-center text-center gap-2 rounded-xl border border-gray-200 p-4 hover:border-blue-mid hover:bg-blue-light/40 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-blue-light flex items-center justify-center">
              <MapPin size={20} className="text-blue-brand" />
            </div>
            <span className="text-sm font-semibold text-gray-900">Use my current location</span>
          </button>
          <button
            onClick={() => setMode("manual")}
            className="flex flex-col items-center text-center gap-2 rounded-xl border border-gray-200 p-4 hover:border-blue-mid hover:bg-blue-light/40 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-blue-light flex items-center justify-center">
              <Edit3 size={20} className="text-blue-brand" />
            </div>
            <span className="text-sm font-semibold text-gray-900">Choose a different address</span>
          </button>
        </div>
      </div>
    );
  }

  if (mode === "current") {
    if (geoState === "locating") {
      return (
        <div className="card p-6 text-center">
          <Loader2 size={28} className="text-blue-brand mx-auto mb-3 animate-spin" />
          <p className="text-gray-600 font-medium">Getting your location…</p>
        </div>
      );
    }
    // denied
    return (
      <div className="card p-6 text-center border border-red-200 bg-red-50">
        <p className="text-red-700 font-medium mb-2">Location access denied</p>
        <p className="text-sm text-red-500 mb-4">
          Enable location in your browser settings, or choose a different address instead.
        </p>
        <div className="flex gap-2 justify-center">
          <button onClick={useCurrentLocation} className="btn-primary text-sm px-4 py-2">Try again</button>
          <button onClick={() => setMode("manual")} className="btn-secondary text-sm px-4 py-2">Choose an address</button>
        </div>
      </div>
    );
  }

  // mode === "manual"
  return (
    <div className="card p-5">
      <button onClick={() => setMode("choice")} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-3">
        <ArrowLeft size={13} /> Back
      </button>
      <p className="font-semibold text-gray-900 mb-3">Search for an address</p>
      <form onSubmit={searchAddress} className="flex gap-2 mb-3">
        <input
          className="input flex-1"
          placeholder="e.g. 12 Allen Avenue, Ikeja, Lagos"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button type="submit" disabled={searching || !query.trim()} className="btn-primary px-4 shrink-0">
          {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        </button>
      </form>

      {searchError && <p className="text-sm text-red-600 mb-2">{searchError}</p>}

      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => pickResult(r)}
              className="w-full flex items-start gap-2 text-left text-sm text-gray-700 rounded-lg border border-gray-100 p-2.5 hover:border-blue-mid hover:bg-blue-light/40 transition-colors"
            >
              <MapPin size={15} className="text-gray-400 mt-0.5 shrink-0" />
              <span className="line-clamp-2">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
