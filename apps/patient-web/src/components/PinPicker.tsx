"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ds";

const NIGERIA: [number, number] = [9.08, 7.4];
// A pin set from further out could be kilometres off, and a provider goes there
const MIN_ZOOM = 15;

// For places no address search knows: the pin stays in the middle and the map
// moves under it, which is far easier than tapping an exact spot on a phone.
export default function PinPicker({ onPick }: { onPick: (coords: { lat: number; lng: number }, address: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [saving, setSaving] = useState(false);
  const [tooFar, setTooFar] = useState(false);

  useEffect(() => {
    let gone = false;
    (async () => {
      const [{ default: L }] = await Promise.all([
        import("leaflet"),
        // @ts-ignore — CSS dynamic import; webpack extracts this into its own chunk (client-only)
        import("leaflet/dist/leaflet.css"),
      ]);
      if (gone || !box.current) return;
      map.current = L.map(box.current, { zoomControl: false }).setView(NIGERIA, 6);
      L.control.zoom({ position: "bottomright" }).addTo(map.current);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map.current);
      navigator.geolocation?.getCurrentPosition(
        pos => { if (!gone) map.current?.setView([pos.coords.latitude, pos.coords.longitude], 16); },
        () => {},
        { timeout: 8000 },
      );
    })();
    return () => { gone = true; map.current?.remove(); map.current = null; };
  }, []);

  async function confirm() {
    if (!map.current) return;
    if (map.current.getZoom() < MIN_ZOOM) { setTooFar(true); return; }
    setTooFar(false);
    setSaving(true);
    const { lat, lng } = map.current.getCenter();
    let address = "Pinned location";
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=17`, { headers: { "Accept-Language": "en" } });
      address = (await res.json())?.display_name ?? address;
    } catch {
      // keep the plain label; the coordinates and any details added are what count
    }
    onPick({ lat, lng }, address);
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-[20px] border border-line">
        <div ref={box} style={{ height: 300 }} />
        <MapPin size={36} aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full fill-accent text-white drop-shadow" />
      </div>
      <p className="mt-2 text-ds-xs text-muted">Move the map until the pin is on the exact spot. Pinch or use + to zoom in.</p>
      {tooFar && <p role="alert" className="mt-2 text-ds-sm font-semibold text-danger">Zoom in closer so the pin is on the exact spot.</p>}
      <Button block className="mt-3" onClick={confirm} disabled={saving}>{saving ? "Saving…" : "Use this spot"}</Button>
    </div>
  );
}
