"use client";
import { useEffect, useRef } from "react";

interface Props {
  providerLat: number | null;
  providerLng: number | null;
  patientLat: number;
  patientLng: number;
  providerName: string;
}

export default function LiveMap({ providerLat, providerLng, patientLat, patientLng, providerName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<{ provider?: any; patient?: any }>({});

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    (async () => {
      const [{ default: L }] = await Promise.all([
        import("leaflet"),
        // @ts-ignore — CSS dynamic import; webpack extracts this into its own chunk (client-only)
        import("leaflet/dist/leaflet.css"),
      ]);
      if (destroyed || !containerRef.current) return;

      // Fix broken default icon paths in bundled environments
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current!, { zoomControl: false });
      mapRef.current = map;

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      const makeIcon = (color: string) =>
        L.icon({
          iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
          iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
        });

      markerRefs.current.patient = L.marker([patientLat, patientLng], { icon: makeIcon("red") })
        .bindPopup("Your location")
        .addTo(map);

      if (providerLat != null && providerLng != null) {
        markerRefs.current.provider = L.marker([providerLat, providerLng], { icon: makeIcon("blue") })
          .bindPopup(providerName)
          .addTo(map);
        map.fitBounds([[patientLat, patientLng], [providerLat, providerLng]], { padding: [60, 60] });
      } else {
        map.setView([patientLat, patientLng], 15);
      }
    })();

    return () => {
      destroyed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRefs.current = {};
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update provider marker position without re-initialising the map
  useEffect(() => {
    if (!mapRef.current || providerLat == null || providerLng == null) return;
    markerRefs.current.provider?.setLatLng([providerLat, providerLng]);
  }, [providerLat, providerLng]);

  return (
    <div
      ref={containerRef}
      className="rounded-xl overflow-hidden border border-gray-100"
      style={{ height: "280px", width: "100%" }}
    />
  );
}