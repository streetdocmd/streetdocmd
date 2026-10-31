import { redirect } from "next/navigation";
import { SERVICE_LABELS, SERVICE_PRICES, SERVICE_PROFESSION } from "@/lib/shared";
import type { ServiceType } from "@/lib/shared";
import { createAdminSupabase } from "@/lib/supabase-server";
import { weeklyHoursOf } from "@/lib/working-hours";
import BookProviderClient, { type BookableProvider } from "./BookProviderClient";

export const dynamic = "force-dynamic";

// Providers set their own prices (provider_services.service_type → price). A provider
// who hasn't priced this service is billed at the platform's standard rate, which the
// booking API applies the same way — the price shown here is always what gets charged.
async function loadProviders(service: ServiceType): Promise<BookableProvider[]> {
  const admin = createAdminSupabase();
  const { data: providers } = await admin
    .from("providers")
    .select("*") // weekly_hours arrives with migration 060; only the fields below reach the browser
    .eq("verification_status", "verified")
    .eq("profession", SERVICE_PROFESSION[service])
    .limit(100);
  if (!providers?.length) return [];

  const { data: prices } = await admin
    .from("provider_services")
    .select("provider_id, price")
    .eq("service_type", service)
    .eq("active", true)
    .in("provider_id", providers.map(p => p.id));
  const priceOf = new Map((prices ?? []).map(p => [p.provider_id as string, Number(p.price)]));

  return providers
    .map(p => ({
      id: p.id as string,
      name: p.name as string,
      photo_url: (p.photo_url as string | null) ?? null,
      specialty: [p.specialty, p.specialist_field].filter(Boolean).join(" · "),
      bio: (p.bio as string | null) ?? null,
      rating: Number(p.rating) || 0,
      reviews: Number(p.review_count) || 0,
      total_visits: Number(p.total_visits) || 0,
      years_experience: Number(p.years_experience) || 0,
      available: !!p.available,
      price: priceOf.get(p.id as string) ?? SERVICE_PRICES[service],
      hours: weeklyHoursOf(p),
    }))
    // Online now first, then best rated, then most experienced
    .sort((a, b) =>
      Number(b.available) - Number(a.available) || b.rating - a.rating || b.total_visits - a.total_visits
    );
}

const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export default async function SelectProviderPage({
  params,
  searchParams,
}: {
  params: { service: string };
  searchParams: { description?: string; care_episode_id?: string; follow_up_id?: string; provider?: string };
}) {
  const service = params.service as ServiceType;
  if (!SERVICE_LABELS[service]) redirect("/dashboard");

  // A follow-up continues with the same provider, so there's nobody to choose
  const isFollowUp = !!searchParams.follow_up_id;
  const providers = isFollowUp ? [] : await loadProviders(service);

  return (
    <div>
      <BookProviderClient
        openProviderId={searchParams.provider}
        title={sentenceCase(SERVICE_LABELS[service])}
        subtitle={isFollowUp
          ? "Follow up visit with your provider"
          : `Verified ${SERVICE_PROFESSION[service]}s who visit you. Each sets their own price.`}
        service={service}
        providers={providers}
        description={searchParams.description}
        careEpisodeId={searchParams.care_episode_id}
        followUpId={searchParams.follow_up_id}
      />
    </div>
  );
}
