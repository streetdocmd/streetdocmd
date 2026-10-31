"use client";
import { useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ds";
import { ui } from "./ui";

export interface FacilityLocation { address: string; lat: number | null; lng: number | null }

interface SearchResult { display_name: string; lat: string; lon: string }

// Same address search as the patient app's LocationPicker. Picking a result
// (or using the device) sets the coordinates that distance matching runs on;
// the facility only ever sees an address.
export default function FacilityLocationField({ value, onChange, noun }: {
  value: FacilityLocation;
  onChange: (next: FacilityLocation) => void;
  /** What matching sends here, e.g. "orders" or "referrals" */
  noun: string;
}) {
  const placed = value.lat != null && value.lng != null;
  const [editing, setEditing] = useState(!placed);
  const [query, setQuery] = useState(placed ? "" : value.address);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  async function search() {
    if (!query.trim() || searching) return;
    setSearching(true);
    setError("");
    setResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query.trim())}&format=json&limit=5&countrycodes=ng`,
        { headers: { "Accept-Language": "en" } },
      );
      const data: SearchResult[] = await res.json();
      if (!data?.length) setError("No match found. Try just the street or area and the city, or use this device's location.");
      setResults(data ?? []);
    } catch {
      setError("Couldn't search right now. Check your connection and try again.");
    }
    setSearching(false);
  }

  function choose(next: FacilityLocation) {
    onChange(next);
    setEditing(false);
    setResults([]);
    setQuery("");
    setError("");
  }

  function useDevice() {
    if (!navigator.geolocation) { setError("This browser can't share its location. Search for your address instead."); return; }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let address = value.address;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { "Accept-Language": "en" } });
          address = (await res.json())?.display_name ?? address;
        } catch {
          // keep the address already on file; the coordinates are what matching needs
        }
        setLocating(false);
        choose({ address, lat, lng });
      },
      () => { setLocating(false); setError("Couldn't get your location. Allow location for this site, or search for your address."); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div className="space-y-3 rounded-ds border border-line p-4">
      <div>
        <b className="block text-ds-sm text-ink">Address</b>
        <small className="block text-ds-xs text-muted">
          Patients are matched to you by distance, so {noun} can&apos;t reach you until your address is confirmed on the map.
        </small>
      </div>

      {placed && !editing ? (
        <div className="flex items-start justify-between gap-3">
          <p className="flex min-w-0 items-start gap-2 text-ds-sm text-ink">
            <MapPin size={16} className="mt-0.5 flex-none text-accent" aria-hidden />
            <span className="min-w-0">
              {value.address}
              <a href={`https://www.google.com/maps?q=${value.lat},${value.lng}`} target="_blank" rel="noopener noreferrer"
                className="mt-0.5 block text-ds-xs font-bold text-accent hover:underline">Check on the map</a>
            </span>
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>Change</Button>
        </div>
      ) : (
        <>
          {!placed && <p className="text-ds-xs font-semibold text-warn">Not confirmed yet</p>}
          <div>
            <label htmlFor="fd-address" className={ui.label}>Search for your address</label>
            <div className="flex gap-2">
              <input id="fd-address" className={ui.input} placeholder="e.g. 12 Allen Avenue, Ikeja, Lagos" value={query}
                onChange={e => { setQuery(e.target.value); setError(""); }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); search(); } }} />
              <Button type="button" variant="secondary" size="sm" className="self-center" aria-label="Search"
                disabled={searching || !query.trim()} onClick={search}>
                {searching ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Search size={16} aria-hidden />}
              </Button>
            </div>
          </div>

          {results.length > 0 && (
            <ul className="overflow-hidden rounded-ds border border-line">
              {results.map(r => (
                <li key={`${r.lat},${r.lon}`} className="border-b border-line last:border-b-0">
                  <button type="button" onClick={() => choose({ address: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) })}
                    className="flex w-full items-start gap-2 p-3 text-left text-ds-sm text-ink hover:bg-page">
                    <MapPin size={15} className="mt-0.5 flex-none text-muted" aria-hidden />
                    <span className="min-w-0">{r.display_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && <p role="alert" className="text-ds-xs font-semibold text-danger">{error}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={locating} onClick={useDevice}>
              {locating ? "Locating…" : "Use this device's location"}
            </Button>
            {placed && <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(false); setResults([]); setError(""); }}>Keep current address</Button>}
          </div>
          <p className={ui.hint}>Use your device only while you&apos;re at the facility.</p>
        </>
      )}
    </div>
  );
}
