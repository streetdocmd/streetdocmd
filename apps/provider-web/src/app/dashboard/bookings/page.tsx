import { createServerSupabase } from "@/lib/supabase-server";
import { SERVICE_LABELS, BOOKING_STATUS_LABELS } from "@streetdocmd/shared";
import ProviderBookingCard from "./ProviderBookingCard";

const ACTIVE = ["accepted", "en_route", "arrived", "in_progress"];

export default async function BookingsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: provider } = await supabase.from("providers").select("id").eq("user_id", user!.id).single();
  if (!provider) return null;

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, service_type, status, patient_address, net_payout, completed_at, created_at, patients:users!patient_id(name)")
    .eq("provider_id", provider.id)
    .order("created_at", { ascending: false });

  const list = bookings ?? [];
  const bookingIds = list.map((b: any) => b.id);

  let visitsMap: Record<string, any> = {};
  let prescriptionsMap: Record<string, any> = {};

  if (bookingIds.length > 0) {
    const { data: visits } = await supabase
      .from("visits")
      .select("id, booking_id, diagnosis, treatment, follow_up_plan")
      .in("booking_id", bookingIds);

    for (const v of visits ?? []) visitsMap[v.booking_id] = v;

    const visitIds = (visits ?? []).map((v: any) => v.id);
    if (visitIds.length > 0) {
      const { data: prescriptions } = await supabase
        .from("prescriptions")
        .select("id, visit_id, pdf_url, drugs")
        .in("visit_id", visitIds);

      for (const p of prescriptions ?? []) prescriptionsMap[p.visit_id] = p;
    }
  }

  const enriched = list.map((b: any) => {
    const visit = visitsMap[b.id];
    if (visit) {
      visit.prescription = prescriptionsMap[visit.id] ?? null;
    }
    return { ...b, visit };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Bookings</h1>

      {enriched.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-semibold text-gray-700">No bookings yet</p>
          <p className="text-sm text-gray-400 mt-1">Your accepted visits will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {enriched.map((b: any) => {
            const isActive = ACTIVE.includes(b.status);
            return (
              <ProviderBookingCard
                key={b.id}
                booking={b}
                serviceLabel={(SERVICE_LABELS as Record<string, string>)[b.service_type]}
                statusLabel={(BOOKING_STATUS_LABELS as Record<string, string>)[b.status]}
                isActive={isActive}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
