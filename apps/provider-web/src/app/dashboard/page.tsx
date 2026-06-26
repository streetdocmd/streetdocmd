import Link from "next/link";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";
import { SERVICE_LABELS, BOOKING_STATUS_LABELS, formatNaira } from "@streetdocmd/shared";
import DispatchCard from "./DispatchCard";
import AvailabilityToggle from "./AvailabilityToggle";
import RealtimeDispatch from "./RealtimeDispatch";
import LocationBroadcaster from "@/components/LocationBroadcaster";

export const revalidate = 0;

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: provider } = await supabase
    .from("providers")
    .select("id, available, rating, total_visits, wallet_balance")
    .eq("user_id", user!.id)
    .single();

  if (!provider) return null;

  const { data: activeBooking } = await supabase
    .from("bookings")
    .select("id, service_type, status, patient_address, fee, net_payout")
    .eq("provider_id", provider.id)
    .in("status", ["accepted", "en_route", "arrived", "in_progress"])
    .order("accepted_at", { ascending: false })
    .limit(1)
    .single();

  // Use admin client for dispatch queue so booking details are always readable
  // regardless of the bookings RLS policy on pending (provider_id = NULL) bookings
  const admin = createAdminSupabase();
  const { data: dispatchQueue } = await admin
    .from("dispatch_queue")
    .select("id, booking_id, expires_at, bookings(service_type, patient_address, fee, net_payout, notes)")
    .eq("provider_id", provider.id)
    .is("response", null)
    .gt("expires_at", new Date().toISOString())
    .order("sent_at", { ascending: true });

  const requests = (dispatchQueue ?? []) as any[];

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{provider.total_visits}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total visits</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{provider.rating > 0 ? provider.rating.toFixed(1) : "—"}</p>
          <p className="text-xs text-gray-400 mt-0.5">Rating</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-teal-brand">{formatNaira(provider.wallet_balance)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Wallet</p>
        </div>
      </div>

      {/* Availability toggle + location broadcaster */}
      <AvailabilityToggle providerId={provider.id} initialAvailable={provider.available} />
      {provider.available && <LocationBroadcaster providerId={provider.id} />}

      {/* Active booking banner */}
      {activeBooking && (
        <div className="bg-teal-light border border-teal-brand/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-teal-brand uppercase tracking-wide mb-0.5">Active visit</p>
            <p className="font-semibold text-gray-900">
              {(SERVICE_LABELS as Record<string, string>)[activeBooking.service_type]}
            </p>
            <p className="text-sm text-gray-500">{activeBooking.patient_address}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {(BOOKING_STATUS_LABELS as Record<string, string>)[activeBooking.status]}
            </p>
          </div>
          <Link href={`/dashboard/active/${activeBooking.id}`} className="btn-teal text-sm">
            Continue →
          </Link>
        </div>
      )}

      {/* Dispatch requests */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Incoming requests
          </h2>
          <RealtimeDispatch providerId={provider.id} />
        </div>

        {requests.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-3xl mb-3">📭</p>
            <p className="font-semibold text-gray-700">No pending requests</p>
            <p className="text-sm text-gray-400 mt-1">
              {provider.available
                ? "New requests will appear here automatically."
                : "Set yourself online above to start receiving requests."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((r: any) => (
              <DispatchCard key={r.id} request={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}