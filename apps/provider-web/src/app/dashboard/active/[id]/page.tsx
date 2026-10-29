import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";
import { SERVICE_LABELS, formatNaira } from "@streetdocmd/shared";
import dynamic from "next/dynamic";
import { ChevronRight, Lock } from "lucide-react";
import { Avatar, Card, TopBar, cx, focusRing } from "@/components/ds";
import ActiveBookingClient from "./ActiveBookingClient";
import LocationBroadcaster from "@/components/LocationBroadcaster";

const ProviderMap = dynamic(() => import("@/components/ProviderMap"), { ssr: false });

export default async function ActiveBookingPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: provider } = await supabase
    .from("providers")
    .select("id, profession")
    .eq("user_id", user.id)
    .single();
  if (!provider) redirect("/dashboard");

  const admin = createAdminSupabase();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, service_type, status, patient_address, patient_lat, patient_lng, fee, net_payout, notes, patient_id, care_episode_id, patient:users!patient_id(phone, name, dob, allergies)")
    .eq("id", params.id)
    .eq("provider_id", provider.id)
    .single();

  if (!booking) redirect("/dashboard");
  if (!["accepted", "en_route", "arrived", "in_progress"].includes(booking.status)) redirect("/dashboard");

  const patient = booking.patient as any;
  const rawLabel = (SERVICE_LABELS as Record<string, string>)[booking.service_type] ?? booking.service_type;
  const serviceLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1).toLowerCase();
  const age = patient?.dob
    ? Math.floor((Date.now() - new Date(`${patient.dob}T00:00:00`).getTime()) / (365.25 * 86_400_000))
    : null;
  const allergies: string[] = (patient?.allergies ?? []).filter(Boolean);
  const directionsUrl = booking.patient_lat && booking.patient_lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${booking.patient_lat},${booking.patient_lng}`
    : booking.patient_address
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(booking.patient_address)}`
      : null;

  return (
    <div className="mx-auto max-w-lg space-y-3.5">
      <TopBar title="Visit" backHref="/dashboard" className="-mx-5 -mt-2 md:mx-0" />

      <ActiveBookingClient
        bookingId={booking.id}
        currentStatus={booking.status as any}
        patientPhone={patient?.phone ?? ""}
        patientId={(booking as any).patient_id}
        providerId={provider.id}
        profession={provider.profession}
        directionsUrl={directionsUrl}
      />

      {/* Patient */}
      <div className="flex items-center gap-3 rounded-ds-lg border border-teal-tint bg-gradient-to-br from-teal-soft to-sky p-4">
        <Avatar name={patient?.name ?? "Patient"} size="sm" tint="var(--surface)" />
        <div className="min-w-0 flex-1">
          <b className="block text-ds-md text-ink">{patient?.name ?? "Patient"}</b>
          <span className="text-ds-sm text-muted">{[age != null ? `${age} years` : null, serviceLabel].filter(Boolean).join(" · ")}</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="rounded-[10px] bg-surface px-2.5 py-[5px] text-ds-xs font-bold text-navy">
              Allergies: {allergies.length ? allergies.join(", ") : "None recorded"}
            </span>
          </div>
        </div>
      </div>

      <Card>
        <h2 className="mb-1.5 text-ds-control font-bold text-navy">Reason for visit</h2>
        <p className="text-ds-sm text-ink/85">{booking.notes || serviceLabel}</p>
        <p className="mt-2 text-ds-xs text-muted">{booking.patient_address}</p>
      </Card>

      <div className="flex gap-2.5 rounded-ds bg-teal-soft p-3 text-ds-xs leading-normal text-navy">
        <Lock size={18} className="mt-px flex-none text-teal-deep" aria-hidden />
        <span>Full address and phone number are shared only with you for this visit.</span>
      </div>

      <div className="flex items-center justify-between rounded-ds-lg border border-line bg-surface px-4 py-3">
        <span className="text-ds-sm text-muted">You receive</span>
        <b className="text-teal-deep tabular-nums">{formatNaira(booking.net_payout)}</b>
      </div>

      <Link
        href={`/dashboard/patients/${booking.patient_id}?booking=${booking.id}`}
        className={cx("flex items-center justify-between rounded-ds-lg border border-line bg-surface px-4 py-3 text-ds-sm font-semibold text-teal-deep", focusRing)}
      >
        <span>View care context before you start</span>
        <ChevronRight size={18} aria-hidden />
      </Link>

      {(booking as any).care_episode_id && (
        <Link
          href={`/dashboard/journeys/${(booking as any).care_episode_id}`}
          className={cx("flex items-center justify-between rounded-ds-lg border border-line bg-surface px-4 py-3 text-ds-sm font-semibold text-teal-deep", focusRing)}
        >
          <span>Care team chat for this patient</span>
          <ChevronRight size={18} aria-hidden />
        </Link>
      )}

      {booking.patient_lat && booking.patient_lng && (
        <div className="overflow-hidden rounded-ds-lg border border-line">
          <ProviderMap
            patientLat={booking.patient_lat}
            patientLng={booking.patient_lng}
            patientName={patient?.name ?? "Patient"}
          />
        </div>
      )}

      <LocationBroadcaster providerId={provider.id} />
    </div>
  );
}
