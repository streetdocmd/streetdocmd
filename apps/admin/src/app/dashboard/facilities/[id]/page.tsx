export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase-server";
import FacilityReviewClient from "./FacilityReviewClient";

export default async function FacilityReviewPage({ params }: { params: { id: string } }) {
  const admin = createAdminSupabase();
  const { data: app, error } = await admin
    .from("facility_applications")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) throw new Error(`Could not load this application: ${error.message}`);
  if (!app) notFound();

  let reviewerName: string | null = null;
  if (app.reviewed_by) {
    const { data: reviewer } = await admin.from("users").select("name").eq("id", app.reviewed_by).maybeSingle();
    reviewerName = reviewer?.name ?? null;
  }

  return <FacilityReviewClient application={app} reviewerName={reviewerName} />;
}
