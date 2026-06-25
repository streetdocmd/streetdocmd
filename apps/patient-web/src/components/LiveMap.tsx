"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon paths broken by webpack
const fixIcon = (color: "blue" | "red") =>
  new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

const providerIcon = fixIcon("blue");
const patientIcon = fixIcon("red");

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(positions, { padding: [60, 60] });
    } else if (positions.length === 1) {
      map.setView(positions[0], 15);
    }
  }, [map, positions]);
  return null;
}

export default function LiveMap({
  providerLat,
  providerLng,
  patientLat,
  patientLng,
  providerName,
}: {
  providerLat: number | null;
  providerLng: number | null;
  patientLat: number;
  patientLng: number;
  providerName: string;
}) {
  const patientPos: [number, number] = [patientLat, patientLng];
  const providerPos: [number, number] | null =
    providerLat != null && providerLng != null ? [providerLat, providerLng] : null;

  const positions: [number, number][] = providerPos
    ? [patientPos, providerPos]
    : [patientPos];

  return (
    <MapContainer
      center={patientPos}
      zoom={14}
      style={{ height: "280px", width: "100%", borderRadius: "12px" }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <FitBounds positions={positions} />

      <Marker position={patientPos} icon={patientIcon}>
        <Popup>Your location</Popup>
      </Marker>

      {providerPos && (
        <Marker position={providerPos} icon={providerIcon}>
          <Popup>{providerName}</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}