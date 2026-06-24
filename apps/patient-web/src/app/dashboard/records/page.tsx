import { createServerSupabase } from "@/lib/supabase-server";
import { SERVICE_LABELS } from "@streetdocmd/shared";
import RecordCard from "./RecordCard";

export default async function RecordsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: visits } = await supabase
    .from("bookings")
    .select("id, service_type, completed_at, providers(name), visits(id, diagnosis, treatment, follow_up_plan, prescription_url)")
    .eq("patient_id", user!.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });

  const list = visits ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Medical Records</h1>

      {list.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">📁</p>
          <p className="font-semibold text-gray-700 text-lg">No records yet</p>
          <p className="text-gray-400 text-sm mt-1">Your visit records will appear here after completed visits.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((b: any) => (
            <RecordCard key={b.id} booking={b} serviceLabel={(SERVICE_LABELS as Record<string, string>)[b.service_type]} />
          ))}
        </div>
      )}
    </div>
  );
}