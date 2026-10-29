import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { onboardingRoute } from "@/lib/onboarding";
import Navbar from "@/components/Navbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // select("*") rather than a column list so a database that hasn't had
  // migration 046 applied yet (agreement_version) can't break every page.
  const { data: provider } = await supabase
    .from("providers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!provider) redirect("/register/individual");

  if (provider.verification_status !== "verified") {
    const { data: docs } = await supabase
      .from("provider_documents")
      .select("document_type")
      .eq("provider_id", provider.id);
    redirect(onboardingRoute(provider, (docs ?? []).map(d => d.document_type)));
  }

  const displayName = (provider.name as string).split(" ").slice(0, 2).join(" ");

  return (
    <div className="min-h-screen flex flex-col bg-page">
      <Navbar providerName={displayName} specialty={provider.specialty} profession={provider.profession} userId={user.id} photoUrl={provider.photo_url ?? null} />
      <main className="flex-1 max-w-6xl mx-auto w-full px-5 pt-5 pb-28 md:pt-8 md:pb-10">
        {children}
      </main>
    </div>
  );
}
