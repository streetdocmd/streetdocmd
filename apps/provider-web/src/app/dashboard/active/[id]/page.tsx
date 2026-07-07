import { redirect } from "next/navigation";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";
import { SERVICE_LABELS, formatNaira } from "@streetdocmd/shared";
import dynamic from "next/dynamic";
import ActiveBookingClient from "./ActiveBookingClient";
import LocationBroadcaster from "@/components/LocationBroadcaster";

const ProviderMap = dynamic(() => import("@/components/ProviderMap"), { ssr: false });

export default async function ActiveBookingPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: provider } = await supabase
    .from("providers")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!provider) redirect("/dashboard");

  const admin = createAdminSupabase();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, service_type, status, patient_address, patient_lat, patient_lng, fee, net_payout, notes, patient_id, patient:users!patient_id(phone, name)")
    .eq("id", params.id)
    .eq("provider_id", provider.id)
    .single();

  if (!booking) redirect("/dashboard");
  if (!["accepted", "en_route", "arrived", "in_progress"].includes(booking.status)) redirect("/dashboard");

  const patient = booking.patient as any;
  const serviceLabel = (SERVICE_LABELS as Record<string, string>)[booking.service_type] ?? booking.service_type;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{serviceLabel}</h1>
        <p className="text-gray-500 text-sm mt-0.5">📍 {booking.patient_address}</p>
        {booking.notes && (
          <p className="text-sm text-gray-500 italic mt-1">Patient note: "{booking.notes}"</p>
        )}
      </div>

      <div className="card p-4 flex justify-around text-center">
        <div>
          <p className="text-xs text-gray-400">Patient</p>
          <p className="font-semibold text-gray-900">{patient?.name ?? "—"}</p>
        </div>
        <div className="w-px bg-gray-100" />
        <div>
          <p className="text-xs text-gray-400">Your payout</p>
          <p className="font-bold text-teal-brand">{formatNaira(booking.net_payout)}</p>
        </div>
      </div>

      {booking.patient_lat && booking.patient_lng && (
        <ProviderMap
          patientLat={booking.patient_lat}
          patientLng={booking.patient_lng}
          patientName={patient?.name ?? "Patient"}
        />
      )}

      <LocationBroadcaster providerId={provider.id} />
      <ActiveBookingClient
        bookingId={booking.id}
        currentStatus={booking.status as any}
        patientPhone={patient?.phone ?? ""}
        patientId={(booking as any).patient_id}
        providerId={provider.id}
      />
    </div>
  );
}