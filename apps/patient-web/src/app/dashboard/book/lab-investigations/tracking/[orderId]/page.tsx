import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import { formatNaira } from "@/lib/shared";

const STATUS_STEPS = [
  "ordered", "confirmed", "sample_collector_dispatched", "sample_collected", "processing", "resulted",
] as const;

const STATUS_LABELS: Record<string, string> = {
  ordered: "Order Placed",
  confirmed: "Confirmed by Lab",
  sample_collector_dispatched: "Sample Collector En Route",
  sample_collected: "Sample Collected",
  processing: "Processing",
  resulted: "Results Ready",
};

const FLAG_COLORS: Record<string, string> = {
  normal: "text-green-700",
  high: "text-red-700",
  low: "text-accent",
  critical: "text-purple-700",
};

export default async function LabOrderTrackingPage({ params }: { params: { orderId: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order } = await supabase
    .from("investigation_orders")
    .select("id, status, ordered_at, tests, clinical_notes, lab_partners(name, address, phone), investigation_results(id, test_name, result_value, unit, reference_range, flag, result_pdf_url)")
    .eq("id", params.orderId)
    .eq("patient_id", user.id)
    .single();

  if (!order) notFound();

  const tests: any[] = (order.tests as any[]) ?? [];
  const results: any[] = (order.investigation_results as any[]) ?? [];
  const total = tests.reduce((sum, t) => sum + (t.price ?? 0), 0);
  const stepIndex = STATUS_STEPS.indexOf(order.status as typeof STATUS_STEPS[number]);
  const lab = order.lab_partners as any;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link href="/dashboard/book/lab-investigations" className="text-sm text-muted hover:text-muted">
        ← Back to lab investigations
      </Link>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-ink">{lab?.name ?? "Lab"}</h1>
          <span className="badge bg-accent-soft text-accent">{STATUS_LABELS[order.status] ?? order.status}</span>
        </div>

        <div className="flex items-center gap-1 mb-4">
          {STATUS_STEPS.map((step, i) => (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${i <= stepIndex ? "bg-accent" : "bg-line"}`} />
              {i < STATUS_STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 ${i < stepIndex ? "bg-accent" : "bg-line"}`} />
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-muted">
          Ordered {new Date(order.ordered_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink mb-3">Investigations</h3>
        <div className="space-y-2">
          {tests.map((t, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-ink">{t.test_name}</span>
              <span className="text-muted">{formatNaira(t.price ?? 0)}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-line">
          <span className="text-sm font-semibold text-ink">Total</span>
          <span className="text-sm font-bold text-accent">{formatNaira(total)}</span>
        </div>
      </div>

      {results.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink mb-3">Results</h3>
          <div className="space-y-3">
            {results.map((r: any) => (
              <div key={r.id} className="border-b border-line last:border-0 pb-3 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{r.test_name}</span>
                  <span className={`text-sm font-semibold ${FLAG_COLORS[r.flag] ?? "text-ink"}`}>
                    {r.result_value}{r.unit ? ` ${r.unit}` : ""}
                  </span>
                </div>
                {r.reference_range && <p className="text-xs text-muted mt-0.5">Reference: {r.reference_range}</p>}
              </div>
            ))}
          </div>
          {results.find((r: any) => r.result_pdf_url) && (
            <a
              href={results.find((r: any) => r.result_pdf_url)?.result_pdf_url}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-sm text-accent border border-accent/30 bg-accent-soft rounded-lg px-4 py-2 hover:bg-accent-soft transition-colors font-medium"
            >
              📄 Download Full Report (PDF)
            </a>
          )}
        </div>
      )}
    </div>
  );
}
