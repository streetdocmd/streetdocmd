import { getDistanceKm } from "@streetdocmd/shared";
import type { createAdminSupabase } from "@/lib/supabase-server";

type Admin = ReturnType<typeof createAdminSupabase>;

function ageFrom(dob: string | null) {
  if (!dob) return null;
  const y = Math.floor((Date.now() - new Date(`${dob}T00:00:00`).getTime()) / (365.25 * 86_400_000));
  return y >= 0 ? y : null;
}

/**
 * Offers currently waiting on this provider, with what the request card shows:
 * the patient's first name, age and allergies only (full details after
 * accepting) and the distance from the provider's last location.
 * Uses the service role: pending bookings have no provider_id, so RLS hides them.
 */
export async function loadOpenOffers(admin: Admin, provider: { id: string; lat: number | null; lng: number | null }) {
  const { data } = await admin
    .from("dispatch_queue")
    .select("id, booking_id, sent_at, expires_at, bookings(service_type, patient_address, fee, net_payout, notes, patient_lat, patient_lng, patient_id, scheduled_at)")
    .eq("provider_id", provider.id)
    .is("response", null)
    .gt("expires_at", new Date().toISOString())
    .order("sent_at", { ascending: true });

  const raw = (data ?? []) as any[];
  const patientIds = [...new Set(raw.map(r => r.bookings?.patient_id).filter(Boolean))];
  const { data: patients } = patientIds.length
    ? await admin.from("users").select("id, name, dob, allergies").in("id", patientIds)
    : { data: [] };
  const byId = new Map(((patients ?? []) as any[]).map(p => [p.id, p]));

  return raw.map(r => {
    const b = r.bookings;
    const p = b ? byId.get(b.patient_id) : null;
    const distance = b && provider.lat != null && provider.lng != null && b.patient_lat != null && b.patient_lng != null
      ? getDistanceKm(provider.lat, provider.lng, b.patient_lat, b.patient_lng)
      : null;
    return {
      ...r,
      distance_km: distance,
      bookings: b ? {
        ...b,
        patient: p ? { first_name: String(p.name ?? "").split(" ")[0] || "Patient", age: ageFrom(p.dob), allergies: p.allergies ?? [] } : null,
      } : null,
    };
  });
}
