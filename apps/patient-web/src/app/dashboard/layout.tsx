import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import Navbar from "@/components/Navbar";
import PolicyUpdateBanner from "@/components/PolicyUpdateBanner";
import { needsLegalAcceptance } from "@/lib/legal-acceptance";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error: profileErr } = await supabase
    .from("users")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  // A login with no public.users row (sign-up interrupted before the
  // profile was saved) can't book anything — bookings reference users(id).
  // Send them to finish sign-up instead of a half-working dashboard.
  if (!profile && !profileErr) redirect("/register?complete=1");

  const firstName = profile?.name?.split(" ")[0] ?? "Patient";

  // Not a hard gate — a patient who hasn't accepted the current Terms /
  // acknowledged the current Privacy Policy (every account from before
  // v2.0) sees a persistent prompt until they do. Queried separately so a
  // missing column (migration 053 not yet applied) can't break the layout.
  const { data: legal, error: legalErr } = profile
    ? await supabase
        .from("users")
        .select("terms_version, privacy_policy_version, terms_accepted_at, privacy_acknowledged_at")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null, error: null };
  if (legalErr) console.error("[dashboard] legal acceptance lookup failed:", legalErr);
  const needsPolicyReview = !legalErr && needsLegalAcceptance(legal);
  const neverAccepted = !legal?.terms_accepted_at && !legal?.privacy_acknowledged_at;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar userName={firstName} userId={user.id} />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 pb-24 md:pb-8">
        {needsPolicyReview && <PolicyUpdateBanner firstTime={neverAccepted} />}
        {children}
      </main>
    </div>
  );
}