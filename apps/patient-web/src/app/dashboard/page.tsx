import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import { SERVICE_LABELS, SERVICE_DESCRIPTIONS } from "@/lib/shared";
import type { ServiceType } from "@/lib/shared";
import EmergencyButton from "@/components/EmergencyButton";

const SERVICES: ServiceType[] = [
  "general_consultation",
  "wellness_check",
  "wound_care",
  "elderly_review",
  "nursing_care",
  "physiotherapy_assessment",
  "physiotherapy_session",
  "custom_request",
];

const SERVICE_ICONS: Record<ServiceType, string> = {
  general_consultation: "🩺",
  wellness_check: "🔬",
  wound_care: "🩹",
  elderly_review: "👴",
  nursing_care: "💉",
  physiotherapy_assessment: "🧑‍⚕️",
  physiotherapy_session: "🏃",
  custom_request: "✏️",
};

export default async function DashboardHome() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("users").select("name").eq("id", user!.id).single();
  const firstName = profile?.name?.split(" ")[0] ?? "there";

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Hello, {firstName} 👋</h1>
        <p className="text-gray-500 mt-1">What care do you need today? A provider will come to you.</p>
      </div>

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Available Services</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {SERVICES.map(service => {
          const href = service === "custom_request" ? "/dashboard/book/custom"
            : service === "wellness_check" ? "/dashboard/book/lab-investigations"
            : `/dashboard/book/${service}`;
          const label = service === "wellness_check" ? "Request Lab Investigations" : SERVICE_LABELS[service];
          const description = service === "wellness_check"
            ? "Book a curated wellness package, or choose the specific tests you need"
            : SERVICE_DESCRIPTIONS[service];

          return (
            <Link
              key={service}
              href={href}
              className="card p-5 hover:shadow-card-md hover:border-blue-mid transition-all group"
            >
              <div className="text-3xl mb-3">{SERVICE_ICONS[service]}</div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-brand transition-colors">
                {label}
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
            </Link>
          );
        })}
      </div>

      <EmergencyButton />
    </div>
  );
}
