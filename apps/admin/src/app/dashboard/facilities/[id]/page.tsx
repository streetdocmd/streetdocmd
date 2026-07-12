export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase-server";
import FacilityReviewClient from "./FacilityReviewClient";

export default async function FacilityReviewPage({ params }: { params: { id: string } }) {
  const admin = createAdminSupabase();
  const { data: app } = await admin
    .from("facility_applications")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!app) redirect("/dashboard/facilities");

  return <FacilityReviewClient application={app} />;
}
