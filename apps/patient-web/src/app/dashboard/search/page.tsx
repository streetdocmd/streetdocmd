import { createAdminSupabase } from "@/lib/supabase-server";
import { weeklyHoursOf } from "@/lib/working-hours";
import { SERVICE_PRICES } from "@/lib/shared";
import type { ServiceType } from "@/lib/shared";
import SearchClient, { type FacilityResult, type ProviderResult } from "./SearchClient";

export const dynamic = "force-dynamic";

// A provider opens on the profile for their main home visit service
const SERVICE_BY_PROFESSION: Record<string, ServiceType> = {
  doctor: "general_consultation",
  nurse: "nursing_care",
  physiotherapist: "physiotherapy_assessment",
};

export default async function SearchPage({ searchParams }: { searchParams: { seg?: string; filter?: string; q?: string } }) {
  const admin = createAdminSupabase();

  const [providersRes, pharmaciesRes, labsRes, hospitalsRes] = await Promise.all([
    admin
      .from("providers")
      .select("id, name, photo_url, specialty, specialist_field, profession, rating, review_count, total_visits, available, languages, weekly_hours, working_hours_start, working_hours_end")
      .eq("verification_status", "verified")
      .in("profession", Object.keys(SERVICE_BY_PROFESSION))
      .limit(200),
    admin.from("pharmacy_partners").select("*").eq("active", true).order("name"),
    admin.from("lab_partners").select("*").eq("active", true).order("name"),
    admin.from("hospital_partners").select("*").eq("active", true).order("name"),
  ]);

  const providerRows = (providersRes.data ?? []) as any[];
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: prices }, { data: timeOff }] = providerRows.length
    ? await Promise.all([
        admin
          .from("provider_services")
          .select("provider_id, service_type, price")
          .eq("active", true)
          .in("provider_id", providerRows.map(p => p.id)),
        admin.from("provider_time_off").select("provider_id, day").gte("day", today).in("provider_id", providerRows.map(p => p.id)),
      ])
    : [{ data: [] }, { data: [] }];
  const offDays = new Map<string, string[]>();
  for (const t of (timeOff ?? []) as any[]) offDays.set(t.provider_id, [...(offDays.get(t.provider_id) ?? []), t.day]);
  const priceOf = new Map(((prices ?? []) as any[]).map(p => [`${p.provider_id}:${p.service_type}`, Number(p.price)]));

  const providers: ProviderResult[] = providerRows
    .map(p => {
      const service = SERVICE_BY_PROFESSION[p.profession];
      return {
        id: p.id,
        name: p.name,
        photo_url: p.photo_url ?? null,
        role: [p.specialty, p.specialist_field].filter(Boolean).join(" · "),
        profession: p.profession,
        rating: Number(p.rating) || 0,
        reviews: Number(p.review_count) || 0,
        visits: Number(p.total_visits) || 0,
        available: !!p.available,
        price: priceOf.get(`${p.id}:${service}`) ?? SERVICE_PRICES[service],
        href: `/dashboard/book/${service}?provider=${p.id}`,
        languages: (p.languages ?? []) as string[],
        hours: weeklyHoursOf(p),
        offDays: offDays.get(p.id) ?? [],
      };
    })
    .sort((a, b) => Number(b.available) - Number(a.available) || b.rating - a.rating || b.visits - a.visits);

  const facilities: FacilityResult[] = [
    ...((pharmaciesRes.data ?? []) as any[]).map(f => ({
      id: f.id, type: "pharmacy" as const, name: f.name, area: f.address ?? null,
      note: f.delivery_eta_minutes ? `Delivery in about ${f.delivery_eta_minutes} min` : "Home delivery",
      href: "/dashboard/book/medication", rating: Number(f.rating) || 0, reviews: Number(f.review_count) || 0, logo_url: f.logo_url ?? null,
      homeCollection: false, emergency: false, ambulance: false,
    })),
    ...((labsRes.data ?? []) as any[]).map(f => ({
      id: f.id, type: "lab" as const, name: f.name, area: f.address ?? null,
      note: f.home_collection_available ? "Home sample collection" : "Lab visit", href: "/dashboard/book/lab-investigations",
      rating: Number(f.rating) || 0, reviews: Number(f.review_count) || 0, logo_url: f.logo_url ?? null,
      homeCollection: !!f.home_collection_available, emergency: false, ambulance: false,
    })),
    ...((hospitalsRes.data ?? []) as any[]).map(f => ({
      id: f.id, type: "hospital" as const, name: f.name, area: f.address ?? null,
      note: f.emergency_available ? "Emergency care" : "Referrals", href: `/dashboard/hospitals/${f.id}`,
      rating: Number(f.rating) || 0, reviews: Number(f.review_count) || 0, logo_url: f.logo_url ?? null,
      homeCollection: false, emergency: !!f.emergency_available, ambulance: !!f.ambulance_available,
    })),
  ].sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);

  return (
    <SearchClient
      providers={providers}
      facilities={facilities}
      initialSeg={searchParams.seg === "facilities" ? "facilities" : "providers"}
      initialFilter={searchParams.filter ?? "all"}
      initialQuery={searchParams.q ?? ""}
    />
  );
}
