import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import ServicesClient from "./ServicesClient";

export default async function ServicesPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: provider } = await supabase
    .from("providers")
    .select("id, profession")
    .eq("user_id", user.id)
    .single();
  if (!provider) redirect("/dashboard");

  // Doctor's bookable services are the fixed consultation types already
  // built into booking — this page is for professions that price and
  // describe their own offerings.
  if (provider.profession === "doctor") redirect("/dashboard");

  const { data: services } = await supabase
    .from("provider_services")
    .select("id, name, description, price, duration_minutes, active, service_type, created_at")
    .eq("provider_id", provider.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Services</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          List the services you offer and their price. Patients see these on your profile.
        </p>
      </div>

      <ServicesClient
        providerId={provider.id}
        profession={provider.profession}
        initialServices={services ?? []}
      />
    </div>
  );
}
