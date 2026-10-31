"use client";
import { useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ds";
import { usePlaceSearch } from "@/lib/use-place-search";
import type { Place } from "@/lib/places";
import { ui } from "./ui";

export interface FacilityLocation { address: string; lat: number | null; lng: number | null }

// Same address search as the patient app, with suggestions as you type. Picking one
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
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const { results, searching, failed, noMatches, locate } = usePlaceSearch("/api/facility/places", editing ? query : "");

  async function pick(place: Place) {
    setError("");
    const found = await locate(place);
    if (found) choose({ address: found.address, lat: found.lat, lng: found.lng });
    else setError("Couldn't get that address. Try another, or use this device's location.");
  }

  function choose(next: FacilityLocation) {
    onChange(next);
    setEditing(false);
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
            <div className="relative">
              <input id="fd-address" className={ui.input} autoComplete="off" placeholder="Street, area or landmark" value={query}
                onChange={e => { setQuery(e.target.value); setError(""); }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (results[0]) pick(results[0]); } }} />
              {searching && <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-muted" aria-hidden />}
            </div>
          </div>

          {results.length > 0 && (
            <ul className="overflow-hidden rounded-ds border border-line">
              {results.map(r => (
                <li key={r.id} className="border-b border-line last:border-b-0">
                  <button type="button" onClick={() => pick(r)}
                    className="flex w-full items-start gap-2 p-3 text-left text-ds-sm text-ink hover:bg-page">
                    <MapPin size={15} className="mt-0.5 flex-none text-muted" aria-hidden />
                    <span className="min-w-0"><b className="block font-semibold">{r.label}</b>{r.detail && <small className="block text-ds-xs text-muted">{r.detail}</small>}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {noMatches && <p className="text-ds-xs text-muted">No match found. Try just the street or area and the city, or use this device&apos;s location.</p>}
          {(error || failed) && <p role="alert" className="text-ds-xs font-semibold text-danger">{error || "Couldn't search right now. Check your connection and try again."}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={locating} onClick={useDevice}>
              {locating ? "Locating…" : "Use this device's location"}
            </Button>
            {placed && <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(false); setError(""); }}>Keep current address</Button>}
          </div>
          <p className={ui.hint}>Use your device only while you&apos;re at the facility.</p>
        </>
      )}
    </div>
  );
}
