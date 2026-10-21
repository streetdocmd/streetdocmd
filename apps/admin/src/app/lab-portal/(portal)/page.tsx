import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function LabPortalRoot() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/lab-portal/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["lab_staff", "admin"].includes(profile.role)) {
    return (
      <div className="text-center py-20">
        <p className="text-2xl mb-2">🚫</p>
        <p className="font-semibold text-gray-700">Access denied</p>
        <p className="text-gray-400 text-sm mt-1">You need a lab staff account to access this portal.</p>
      </div>
    );
  }

  redirect("/lab-portal/dashboard");
}
