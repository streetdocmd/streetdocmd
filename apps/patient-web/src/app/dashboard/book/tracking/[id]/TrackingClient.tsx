"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase";
import { getDistanceKm, getEtaMinutes } from "@/lib/shared";
import { Radio } from "lucide-react";
import { Pill } from "@/components/ds";

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
        ({ new: row }) => {
          if (row.status === "completed") {
            router.push(`/dashboard/book/rate/${bookingId}?providerId=${providerId}`);
          } else {
            router.refresh();
          }
        }
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
    <div className="relative overflow-hidden rounded-ds-lg border border-line bg-surface">
      <LiveMap
        providerLat={providerLat}
        providerLng={providerLng}
        patientLat={patientLat}
        patientLng={patientLng}
        providerName={providerName}
      />
      <div className="pointer-events-none absolute left-3 top-3 z-[400]">
        <Pill tone="ok" icon={Radio}>Live</Pill>
      </div>

      {/* Arrival card */}
      <div className="flex items-center gap-4 border-t border-line p-4">
        <div className="flex-1">
          <small className="text-ds-xs font-semibold text-muted">Arriving in</small>
          <div className="text-ds-2xl font-extrabold leading-tight text-navy tabular-nums">{eta != null ? `${eta} min` : "Updating"}</div>
        </div>
        {distanceKm != null && (
          <div className="text-right">
            <small className="block text-ds-xs font-semibold text-muted">Distance</small>
            <b className="text-ds-md text-ink tabular-nums">{distanceKm.toFixed(1)} km</b>
          </div>
        )}
      </div>
      <p className="sr-only" aria-live="polite">Live tracking updates every 10 seconds.</p>
    </div>
  );
}