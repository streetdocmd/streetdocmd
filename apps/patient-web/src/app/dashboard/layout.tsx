import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import Navbar from "@/components/Navbar";
import PolicyUpdateBanner from "@/components/PolicyUpdateBanner";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy-policy";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, core_consent_policy_version")
    .eq("id", user.id)
    .single();

  const firstName = profile?.name?.split(" ")[0] ?? "Patient";
  // Not a hard re-consent gate for this pass — a patient who accepted an
  // older policy version (or never had one recorded, e.g. pre-existing
  // accounts from before this feature) just sees a dismissible prompt.
  const needsPolicyReview = profile?.core_consent_policy_version !== PRIVACY_POLICY_VERSION;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar userName={firstName} />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {needsPolicyReview && <PolicyUpdateBanner />}
        {children}
      </main>
    </div>
  );
}