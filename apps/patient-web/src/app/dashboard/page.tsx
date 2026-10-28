import { createServerSupabase } from "@/lib/supabase-server";
import HomeView from "./HomeView";
import { refillItems, REFILL_SOON_DAYS } from "@/lib/refills";

const ACTIVE_STATUSES = ["accepted", "en_route", "arrived", "in_progress"];

export default async function DashboardHome({ searchParams }: { searchParams?: { welcome?: string } }) {
  const justOnboarded = searchParams?.welcome === "1";
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, { count: bookingCount }] = await Promise.all([
    supabase.from("users").select("name, dob, gender, emergency_contact_name").eq("id", user!.id).maybeSingle(),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("patient_id", user!.id),
  ]);
  const firstName = profile?.name?.split(" ")[0] ?? "there";
  // Onboarding step 2 can be skipped: HomeView keeps nudging until the details a
  // visiting clinician relies on (dob, gender, emergency contact) are filled in.
  const isFirstVisit = (bookingCount ?? 0) === 0;

  // "Your Care" — surfaces only when real data supports it: an in-progress
  // visit takes priority (most actionable), otherwise the soonest booking
  // that's actually been scheduled for a future time (Phase 4 scheduling).
  // No data invented — this section simply doesn't render if neither exists.
  const [{ data: activeBooking }, { data: upcomingBooking }] = await Promise.all([
    // 'accepted' is active only if it's not actually a future-scheduled
    // slot (that's the "upcoming" query below) — en_route/arrived/
    // in_progress are always active regardless of scheduled_at.
    supabase
      .from("bookings")
      .select("id, service_type, status, scheduled_at, providers!bookings_provider_id_fkey(name)")
      .eq("patient_id", user!.id)
      .in("status", ACTIVE_STATUSES)
      .or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // 'accepted' specifically — a provider has actually confirmed for this
    // slot, not just "payment received, still searching" (status 'paid').
    supabase
      .from("bookings")
      .select("id, service_type, status, scheduled_at, providers!bookings_provider_id_fkey(name)")
      .eq("patient_id", user!.id)
      .eq("status", "accepted")
      .not("scheduled_at", "is", null)
      .gt("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const careBooking = (activeBooking ?? upcomingBooking) as any;

  // Refill reminder: the medicine running out soonest (5 days or fewer, not long finished)
  const { data: prescriptions } = await supabase
    .from("prescriptions")
    .select("created_at, drugs")
    .eq("patient_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(20);
  // Continue where you left off (unpaid booking or medicine order) and Book again (recent providers)
  const [{ data: unpaidBooking }, { data: unpaidOrder }, { data: pastVisits }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, service_type, created_at, providers!bookings_provider_id_fkey(name)")
      .eq("patient_id", user!.id)
      .eq("status", "pending_payment")
      .gt("created_at", new Date(Date.now() - 2 * 86_400_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("prescription_orders")
      .select("id, drugs, created_at, pharmacy_partners(name)")
      .eq("patient_id", user!.id)
      .eq("status", "pending_payment")
      .gt("created_at", new Date(Date.now() - 2 * 86_400_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select("service_type, provider_id, providers!bookings_provider_id_fkey(id, name, photo_url, specialty, rating, referral_code)")
      .eq("patient_id", user!.id)
      .eq("status", "completed")
      .not("provider_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);
  const resume = unpaidBooking
    ? { href: `/dashboard/book/payment/${(unpaidBooking as any).id}`, kind: "visit" as const, title: (unpaidBooking as any).service_type as string, sub: (unpaidBooking as any).providers?.name ?? null }
    : unpaidOrder
      ? { href: `/dashboard/book/medication/payment/${(unpaidOrder as any).id}`, kind: "order" as const, title: ((unpaidOrder as any).drugs ?? []).map((d: any) => d.drug_name).join(", ") || "Medicine order", sub: (unpaidOrder as any).pharmacy_partners?.name ?? null }
      : null;
  const seen = new Set<string>();
  const bookAgain = ((pastVisits ?? []) as any[])
    .filter(v => v.providers && !seen.has(v.provider_id) && seen.add(v.provider_id))
    .slice(0, 3)
    .map(v => ({
      id: v.provider_id as string,
      name: v.providers.name as string,
      photo: (v.providers.photo_url as string | null) ?? null,
      role: (v.providers.specialty as string | null) ?? null,
      rating: Number(v.providers.rating) || 0,
      href: v.providers.referral_code
        ? `/dashboard/book/preferred-provider?code=${encodeURIComponent(v.providers.referral_code)}`
        : `/dashboard/book/${v.service_type}?provider=${v.provider_id}`,
    }));

  const refill = refillItems((prescriptions ?? []) as any[]).find(r => r.daysLeft <= REFILL_SOON_DAYS && r.daysLeft > -3) ?? null;

  return (
    <HomeView
      firstName={firstName}
      justOnboarded={justOnboarded}
      profileChecks={profile ? { dob: !!profile.dob, gender: !!profile.gender, emergencyContact: !!profile.emergency_contact_name } : null}
      isFirstVisit={isFirstVisit}
      careBooking={careBooking ? {
        id: careBooking.id,
        service_type: careBooking.service_type,
        status: careBooking.status,
        scheduled_at: careBooking.scheduled_at,
        providerName: careBooking.providers?.name ?? null,
      } : null}
      careIsActive={!!activeBooking}
      refill={refill}
      resume={resume}
      bookAgain={bookAgain}
      now={new Date()}
    />
  );
}
