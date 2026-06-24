import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import Navbar from "@/components/Navbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name")
    .eq("id", user.id)
    .single();

  const firstName = profile?.name?.split(" ")[0] ?? "Patient";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar userName={firstName} />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {children}
      </main>
    </div>
  );
}