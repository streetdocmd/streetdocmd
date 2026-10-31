import { createServerSupabase } from "@/lib/supabase-server";
import LabInvestigationClient from "./LabInvestigationClient";

export default async function CustomLabInvestigationsPage({ searchParams }: { searchParams?: { add?: string } }) {
  const supabase = await createServerSupabase();

  const { data: catalogue } = await supabase
    .from("investigation_catalogue")
    .select("*")
    .eq("scope", "platform")
    .eq("active", true)
    .order("test_name");

  return <LabInvestigationClient catalogue={(catalogue ?? []).filter(t => !t.requested_only)} preselect={searchParams?.add?.split("|").filter(Boolean) ?? []} />;
}
