import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { SERVICE_LABELS } from "@streetdocmd/shared";
import type { ServiceType } from "@streetdocmd/shared";
import BookProviderClient from "./BookProviderClient";

export default async function SelectProviderPage({
  params,
  searchParams,
}: {
  params: { service: string };
  searchParams: { description?: string };
}) {
  const service = params.service as ServiceType;
  if (!SERVICE_LABELS[service]) redirect("/dashboard");

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: providers } = await supabase
    .from("providers")
    .select("id, name, specialty, credentials, rating, total_visits, lat, lng")
    .eq("verification_status", "verified")
    .eq("available", true)
    .not("lat", "is", null);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{SERVICE_LABELS[service]}</h1>
        <p className="text-gray-500 text-sm mt-0.5">Select a provider near you</p>
      </div>

      {searchParams.description && (
        <div className="bg-blue-light border border-blue-mid rounded-lg px-4 py-3 mb-5 text-sm text-blue-brand">
          <span className="font-semibold">Your request: </span>{searchParams.description}
        </div>
      )}

      <BookProviderClient
        providers={providers ?? []}
        service={service}
        userId={user!.id}
        description={searchParams.description}
      />
    </div>
  );
}