import { createServerSupabase } from "@/lib/supabase-server";
import WellnessPackagePicker from "./WellnessPackagePicker";

export default async function WellnessPage() {
  const supabase = await createServerSupabase();

  const { data: packages } = await supabase
    .from("wellness_packages")
    .select("id, name, price, description, included_tests")
    .eq("active", true)
    .order("sort_order");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Wellness Check</h1>
        <p className="text-gray-500 text-sm mt-0.5">Choose a package — a provider will be dispatched to collect your samples</p>
      </div>

      <WellnessPackagePicker packages={packages ?? []} />
    </div>
  );
}
