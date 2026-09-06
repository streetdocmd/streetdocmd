import { createServerSupabase } from "@/lib/supabase-server";
import LabInvestigationClient from "./LabInvestigationClient";

export default async function CustomLabInvestigationsPage() {
  const supabase = await createServerSupabase();

  const { data: catalogue } = await supabase
    .from("investigation_catalogue")
    .select("id, test_name, test_code, price, turnaround_hours, sample_type")
    .eq("scope", "platform")
    .eq("active", true)
    .order("test_name");

  return <LabInvestigationClient catalogue={catalogue ?? []} />;
}
