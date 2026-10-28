import { createAdminSupabase } from "@/lib/supabase-server";
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
      .select("id, name, photo_url, specialty, specialist_field, profession, rating, total_visits, available")
      .eq("verification_status", "verified")
      .in("profession", Object.keys(SERVICE_BY_PROFESSION))
      .limit(200),
    admin.from("pharmacy_partners").select("*").eq("active", true).order("name"),
    admin.from("lab_partners").select("*").eq("active", true).order("name"),
    admin.from("hospital_partners").select("*").eq("active", true).order("name"),
  ]);

  const providerRows = (providersRes.data ?? []) as any[];
  const { data: prices } = providerRows.length
    ? await admin
        .from("provider_services")
        .select("provider_id, service_type, price")
        .eq("active", true)
        .in("provider_id", providerRows.map(p => p.id))
    : { data: [] };
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
        visits: Number(p.total_visits) || 0,
        available: !!p.available,
        price: priceOf.get(`${p.id}:${service}`) ?? SERVICE_PRICES[service],
        href: `/dashboard/book/${service}?provider=${p.id}`,
      };
    })
    .sort((a, b) => Number(b.available) - Number(a.available) || b.rating - a.rating || b.visits - a.visits);

  const facilities: FacilityResult[] = [
    ...((pharmaciesRes.data ?? []) as any[]).map(f => ({
      id: f.id, type: "pharmacy" as const, name: f.name, area: f.address ?? null,
      note: f.delivery_eta_minutes ? `Delivery in about ${f.delivery_eta_minutes} min` : "Home delivery",
      href: "/dashboard/book/medication",
    })),
    ...((labsRes.data ?? []) as any[]).map(f => ({
      id: f.id, type: "lab" as const, name: f.name, area: f.address ?? null,
      note: "Home sample collection", href: "/dashboard/book/lab-investigations",
    })),
    ...((hospitalsRes.data ?? []) as any[]).map(f => ({
      id: f.id, type: "hospital" as const, name: f.name, area: f.address ?? null,
      note: f.emergency_available ? "Emergency care" : "Referrals", href: `/dashboard/hospitals/${f.id}`,
    })),
  ];

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
