import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import { formatNaira, SERVICE_PRICES } from "@/lib/shared";

const STATUS_LABELS: Record<string, string> = {
  ordered: "Order Placed",
  confirmed: "Confirmed by Lab",
  sample_collector_dispatched: "Sample Collector En Route",
  sample_collected: "Sample Collected",
  processing: "Processing",
  resulted: "Results Ready",
};

export default async function LabInvestigationsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: pastOrders } = await supabase
    .from("investigation_orders")
    .select("id, status, ordered_at, tests, lab_partners(name)")
    .eq("patient_id", user.id)
    .eq("requested_by", "patient")
    .order("ordered_at", { ascending: false })
    .limit(10);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Request Lab Investigations</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Choose a curated wellness package, or pick the specific tests you need.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/dashboard/book/wellness_check" className="card p-5 hover:shadow-card-md hover:border-blue-mid transition-all group">
          <div className="text-3xl mb-3">🌿</div>
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-brand transition-colors">Wellness Check Package</h3>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            A curated panel of routine screening tests — blood tests, urinalysis, and more.
          </p>
          <p className="text-sm font-semibold text-blue-brand mt-3">{formatNaira(SERVICE_PRICES.wellness_check)}</p>
        </Link>

        <Link href="/dashboard/book/lab-investigations/custom" className="card p-5 hover:shadow-card-md hover:border-blue-mid transition-all group">
          <div className="text-3xl mb-3">🔬</div>
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-brand transition-colors">Choose Specific Tests</h3>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Search and select exactly the investigations you need from our lab partner's test menu.
          </p>
          <p className="text-sm font-semibold text-blue-brand mt-3">Priced per test</p>
        </Link>
      </div>

      {pastOrders && pastOrders.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Recent Requests</h2>
          <div className="space-y-2">
            {pastOrders.map((o: any) => (
              <Link
                key={o.id}
                href={`/dashboard/book/lab-investigations/tracking/${o.id}`}
                className="card p-4 flex items-center justify-between hover:shadow-card-md transition-all"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {(o.tests as any[])?.map(t => t.test_name).join(", ")}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {o.lab_partners?.name} · {new Date(o.ordered_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <span className="badge bg-blue-50 text-blue-700 shrink-0 ml-3">
                  {STATUS_LABELS[o.status] ?? o.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
