import { createServerSupabase } from "@/lib/supabase-server";
import Link from "next/link";

export default async function VisitsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: summaries } = await supabase
    .from("visit_summaries")
    .select("id, visit_date, provider_name, plain_diagnosis, reason_for_visit")
    .eq("patient_id", user!.id)
    .eq("visible_to_patient", true)
    .order("visit_date", { ascending: false });

  const list = summaries ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Visit History</h1>

      {list.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">🏥</p>
          <p className="font-semibold text-gray-700 text-lg">No visit summaries yet</p>
          <p className="text-sm text-gray-400 mt-1">Your visit summaries will appear here after each completed visit.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(s => (
            <div key={s.id} className="card p-5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">
                  {s.visit_date ? new Date(s.visit_date).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }) : "Date unknown"}
                </p>
                <p className="text-sm text-gray-600 mt-0.5">{s.provider_name}</p>
                {s.plain_diagnosis && (
                  <p className="text-sm text-teal-700 font-medium mt-1 truncate">{s.plain_diagnosis}</p>
                )}
              </div>
              <Link href={`/dashboard/visits/${s.id}`} className="btn-teal text-sm px-4 py-2 whitespace-nowrap">
                View Details →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
