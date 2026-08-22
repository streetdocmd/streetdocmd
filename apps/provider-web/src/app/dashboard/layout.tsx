import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import Navbar from "@/components/Navbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: provider } = await supabase
    .from("providers")
    .select("id, name, verification_status")
    .eq("user_id", user.id)
    .single();

  if (!provider) redirect("/register/individual");

  if (provider.verification_status !== "verified") {
    const { data: docs } = await supabase
      .from("provider_documents")
      .select("id")
      .eq("provider_id", provider.id)
      .limit(1);
    redirect(docs && docs.length > 0 ? "/onboarding/pending" : "/onboarding/documents");
  }

  const firstName = provider.name.split(" ").slice(0, 2).join(" ");

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar providerName={firstName} />
      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}