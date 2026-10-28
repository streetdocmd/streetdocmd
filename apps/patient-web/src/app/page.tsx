import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import WelcomeFlow from "@/components/welcome/WelcomeFlow";

export default async function RootPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  // Signed out: the welcome flow ends at /register, where this page used to redirect
  return <WelcomeFlow />;
}