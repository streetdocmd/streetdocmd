"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase";
import { getDistanceKm, getEtaMinutes } from "@streetdocmd/shared";

const LiveMap = dynamic(() => import("@/components/LiveMap"), { ssr: false });

interface Props {
  bookingId: string;
  providerId: string;
  providerName: string;
  patientLat: number;
  patientLng: number;
  initialProviderLat: number | null;
  initialProviderLng: number | null;
}

export default function TrackingClient({
  bookingId,
  providerId,
  providerName,
  patientLat,
  patientLng,
  initialProviderLat,
  initialProviderLng,
}: Props) {
  const router = useRouter();
  const [providerLat, setProviderLat] = useState(initialProviderLat);
  const [providerLng, setProviderLng] = useState(initialProviderLng);

  const distanceKm =
    providerLat != null && providerLng != null
      ? getDistanceKm(patientLat, patientLng, providerLat, providerLng)
      : null;
  const eta = distanceKm != null ? getEtaMinutes(distanceKm) : null;

  useEffect(() => {
    const supabase = createClient();

    // Watch booking status changes
    const bookingChannel = supabase
      .channel(`tracking-booking-${bookingId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        () => router.refresh()
      )
      .subscribe();

    // Watch provider location changes (lat/lng update every 10s)
    const providerChannel = supabase
      .channel(`tracking-provider-${providerId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "providers", filter: `id=eq.${providerId}` },
        ({ new: row }) => {
          if (row.lat != null) setProviderLat(row.lat);
          if (row.lng != null) setProviderLng(row.lng);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bookingChannel);
      supabase.removeChannel(providerChannel);
    };
  }, [bookingId, providerId, router]);

  return (
    <div className="space-y-4">
      {/* Live map */}
      <div className="rounded-xl overflow-hidden shadow-sm border border-gray-100">
        <LiveMap
          providerLat={providerLat}
          providerLng={providerLng}
          patientLat={patientLat}
          patientLng={patientLng}
          providerName={providerName}
        />
      </div>

      {/* Distance + ETA */}
      {distanceKm != null && (
        <div className="card p-4 flex items-center justify-around text-center">
          <div>
            <p className="text-2xl font-bold text-blue-brand">{distanceKm.toFixed(1)} km</p>
            <p className="text-xs text-gray-400 mt-0.5">Distance away</p>
          </div>
          <div className="w-px h-10 bg-gray-100" />
          <div>
            <p className="text-2xl font-bold text-teal-brand">{eta} min</p>
            <p className="text-xs text-gray-400 mt-0.5">Estimated arrival</p>
          </div>
        </div>
      )}

      {/* Live indicator */}
      <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
        Live tracking active · updates every 10 seconds
      </div>
    </div>
  );
}