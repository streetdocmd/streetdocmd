import { createServerSupabase } from "@/lib/supabase-server";
import LabInvestigationClient from "./LabInvestigationClient";

export default async function CustomLabInvestigationsPage() {
  const supabase = await createServerSupabase();

  // Same "first active lab partner" selection the provider-ordered flow
  // already uses — there's no patient-facing lab-picker yet.
  const { data: lab } = await supabase
    .from("lab_partners")
    .select("id, name")
    .eq("active", true)
    .limit(1)
    .single();

  if (!lab) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-8 text-center">
          <p className="text-3xl mb-2">🔬</p>
          <p className="font-semibold text-gray-700">No lab partner available right now</p>
          <p className="text-sm text-gray-400 mt-1">Please check back shortly.</p>
        </div>
      </div>
    );
  }

  const { data: catalogue } = await supabase
    .from("investigation_catalogue")
    .select("id, test_name, test_code, price, turnaround_hours, sample_type")
    .eq("lab_partner_id", lab.id)
    .eq("active", true)
    .order("test_name");

  return (
    <LabInvestigationClient
      labPartnerId={lab.id}
      labName={lab.name}
      catalogue={catalogue ?? []}
    />
  );
}
