import { redirect, notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import VisitSummaryClient from "./VisitSummaryClient";

export default async function VisitSummaryPage({ params }: { params: { visitId: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: summary } = await supabase
    .from("visit_summaries")
    .select("*")
    .eq("id", params.visitId)
    .eq("patient_id", user.id)
    .eq("visible_to_patient", true)
    .single();

  if (!summary) notFound();

  return <VisitSummaryClient summary={summary} />;
}
