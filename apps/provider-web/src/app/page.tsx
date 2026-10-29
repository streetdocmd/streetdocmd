import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";

// provider.streetdocmd.com opens on the provider type chooser; signed in
// providers go straight to their dashboard (which routes onboarding too).
export default async function RootPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  redirect(user ? "/dashboard" : "/register");
}
