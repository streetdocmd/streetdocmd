import { redirect } from "next/navigation";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

const PARTNER_PORTAL: Record<string, string> = {
  lab_staff: "/lab-portal", pharmacy_staff: "/pharmacy-portal", hospital_staff: "/hospital-portal",
};

export default async function RootPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Facility partners go to their own portal rather than bouncing off the admin dashboard
  const { data: profile } = await createAdminSupabase().from("users").select("role").eq("id", user.id).maybeSingle();
  const portal = profile?.role ? PARTNER_PORTAL[profile.role] : undefined;
  redirect(portal ?? "/dashboard");
}
