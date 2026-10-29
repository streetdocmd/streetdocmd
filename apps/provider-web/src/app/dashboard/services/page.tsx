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

  const { data: services } = await supabase
    .from("provider_services")
    .select("id, name, description, price, duration_minutes, active, service_type, created_at")
    .eq("provider_id", provider.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy">Rates and services</h1>
        <p className="text-sm text-muted mt-0.5">
          Set your rate for each visit type. Patients see it when they choose you, plus a 5 percent service charge at checkout.
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
