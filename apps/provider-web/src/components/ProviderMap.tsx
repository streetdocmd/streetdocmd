"use client";
import { useEffect, useRef } from "react";

interface Props {
  patientLat: number;
  patientLng: number;
  patientName: string;
}

export default function ProviderMap({ patientLat, patientLng, patientName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const providerMarkerRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    (async () => {
      const [{ default: L }] = await Promise.all([
        import("leaflet"),
        // @ts-ignore — CSS dynamic import
        import("leaflet/dist/leaflet.css"),
      ]);
      if (destroyed || !containerRef.current) return;

      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const makeIcon = (color: string) =>
        L.icon({
          iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
          iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
        });

      const map = L.map(containerRef.current!, { zoomControl: false });
      mapRef.current = map;

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      // Patient pin (red = destination)
      L.marker([patientLat, patientLng], { icon: makeIcon("red") })
        .bindPopup(`📍 ${patientName}`)
        .addTo(map);

      map.setView([patientLat, patientLng], 15);

      // Watch provider's own GPS and update blue pin
      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            if (destroyed) return;
            const { latitude, longitude } = pos.coords;
            if (providerMarkerRef.current) {
              providerMarkerRef.current.setLatLng([latitude, longitude]);
            } else {
              providerMarkerRef.current = L.marker([latitude, longitude], { icon: makeIcon("blue") })
                .bindPopup("You")
                .addTo(map);
            }
            // Fit both pins in view
            map.fitBounds(
              [[patientLat, patientLng], [latitude, longitude]],
              { padding: [50, 50], maxZoom: 16 }
            );
          },
          null,
          { enableHighAccuracy: true, maximumAge: 5000 }
        );
      }
    })();

    return () => {
      destroyed = true;
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
      providerMarkerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${patientLat},${patientLng}&travelmode=driving`;

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="rounded-xl overflow-hidden border border-gray-100"
        style={{ height: "260px", width: "100%" }}
      />
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-blue-200 text-blue-700 text-sm font-medium hover:bg-blue-50 transition-colors"
      >
        🗺️ Open in Google Maps
      </a>
    </div>
  );
}