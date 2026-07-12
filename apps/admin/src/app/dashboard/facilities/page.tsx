export const dynamic = "force-dynamic";
import { createAdminSupabase } from "@/lib/supabase-server";
import FacilitiesClient from "./FacilitiesClient";

export default async function FacilitiesPage() {
  const admin = createAdminSupabase();

  const { data: applications } = await admin
    .from("facility_applications")
    .select("*")
    .order("created_at", { ascending: false });

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const apps = applications ?? [];
  const stats = {
    total:      apps.length,
    pending:    apps.filter(a => a.status === "pending" || a.status === "under_review").length,
    approvedThisMonth: apps.filter(a => a.status === "approved" && a.reviewed_at >= firstOfMonth).length,
    rejected:   apps.filter(a => a.status === "rejected").length,
  };

  return <FacilitiesClient applications={apps} stats={stats} />;
}
