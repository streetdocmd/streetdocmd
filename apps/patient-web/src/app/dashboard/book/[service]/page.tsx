import { redirect } from "next/navigation";
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{SERVICE_LABELS[service]}</h1>
        <p className="text-gray-500 text-sm mt-0.5">Nearest available provider will be dispatched</p>
      </div>

      <BookProviderClient
        service={service}
        description={searchParams.description}
      />
    </div>
  );
}