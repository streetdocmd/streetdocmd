"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_FLOW = [
  { value: "ordered",                    label: "Order Placed" },
  { value: "confirmed",                  label: "Confirmed" },
  { value: "sample_collector_dispatched", label: "Collector Dispatched" },
  { value: "sample_collected",           label: "Sample Collected" },
  { value: "processing",                 label: "Processing" },
  { value: "resulted",                   label: "Resulted" },
];

const STATUS_COLOR: Record<string, string> = {
  ordered:                    "bg-yellow-100 text-yellow-700",
  confirmed:                  "bg-blue-100 text-blue-700",
  sample_collector_dispatched:"bg-indigo-100 text-indigo-700",
  sample_collected:           "bg-purple-100 text-purple-700",
  processing:                 "bg-orange-100 text-orange-700",
  resulted:                   "bg-green-100 text-green-700",
};

interface ResultRow {
  id?: string;
  test_name: string;
  result_value: string;
  unit: string;
  reference_range: string;
  flag: "normal" | "high" | "low" | "critical";
}

export default function OrderDetail({ order }: { order: any }) {
  const router = useRouter();
  const currentIdx = STATUS_FLOW.findIndex(s => s.value === order.status);
  const nextStep = STATUS_FLOW[currentIdx + 1];

  const [advancing, setAdvancing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [resultRows, setResultRows] = useState<ResultRow[]>(
    order.tests?.map((t: any) => ({
      test_name: t.test_name,
      result_value: "",
      unit: "",
      reference_range: "",
      flag: "normal" as const,
    })) ?? []
  );
  const [error, setError] = useState("");

  const existingResults: any[] = order.investigation_results ?? [];
  const hasResults = existingResults.length > 0;

  function updateRow(i: number, field: keyof ResultRow, value: string) {
    setResultRows(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  async function advanceStatus() {
    if (!nextStep) return;
    setAdvancing(true);
    const res = await fetch(`/api/lab-portal/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStep.value }),
    });
    setAdvancing(false);
    if (res.ok) router.refresh();
    else setError("Failed to update status");
  }

  async function submitResults() {
    setSubmitting(true);
    setError("");

    const formData = new FormData();
    formData.append("results", JSON.stringify(resultRows));
    if (pdfFile) formData.append("pdf", pdfFile);

    const res = await fetch(`/api/lab-portal/orders/${order.id}/results`, {
      method: "POST",
      body: formData,
    });

    setSubmitting(false);
    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to upload results");
    }
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <button onClick={() => router.back()} className="text-sm text-teal-600 hover:underline">← Back to orders</button>

      {/* Order header */}
      <div className="card p-5 space-y-3">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="font-bold text-gray-900 text-lg">{order.users?.name ?? "Patient"}</p>
            <p className="text-sm text-gray-500">{order.users?.phone}</p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLOR[order.status] ?? "bg-gray-100 text-gray-600"}`}>
            {STATUS_FLOW.find(s => s.value === order.status)?.label ?? order.status}
          </span>
        </div>
        <div className="text-sm text-gray-600">
          <span className="font-medium">Ordered by:</span> Dr {order.providers?.name}{order.providers?.credentials ? ` (${order.providers.credentials})` : ""}
        </div>
        {order.clinical_notes && (
          <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-800">
            <span className="font-semibold">Clinical notes: </span>{order.clinical_notes}
          </div>
        )}
      </div>

      {/* Status progress */}
      <div className="card p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Status Progress</p>
        <div className="flex gap-1 flex-wrap">
          {STATUS_FLOW.map((step, i) => (
            <div key={step.value} className="flex items-center gap-1">
              <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium ${
                i < currentIdx ? "bg-green-100 text-green-700" :
                i === currentIdx ? "bg-teal-600 text-white" :
                "bg-gray-100 text-gray-400"
              }`}>
                {i < currentIdx && "✓ "}{step.label}
              </div>
              {i < STATUS_FLOW.length - 1 && <span className="text-gray-300 text-xs">→</span>}
            </div>
          ))}
        </div>

        {nextStep && order.status !== "resulted" && (
          <button
            onClick={advanceStatus}
            disabled={advancing}
            className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50"
          >
            {advancing ? "Updating…" : `Mark as: ${nextStep.label}`}
          </button>
        )}
      </div>

      {/* Tests ordered */}
      <div className="card p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Tests Ordered</p>
        <div className="divide-y divide-gray-100">
          {order.tests?.map((t: any, i: number) => (
            <div key={i} className="flex justify-between py-2">
              <span className="text-sm font-medium text-gray-900">{t.test_name}</span>
              <span className="text-sm text-gray-500">₦{t.price?.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between pt-3 border-t border-gray-100 mt-1">
          <span className="text-sm font-bold text-gray-700">Total</span>
          <span className="text-sm font-bold text-gray-900">
            ₦{order.tests?.reduce((s: number, t: any) => s + (t.price ?? 0), 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Existing results */}
      {hasResults && (
        <div className="card p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Uploaded Results</p>
          <div className="divide-y divide-gray-100">
            {existingResults.map((r: any) => (
              <div key={r.id} className="flex justify-between items-center py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.test_name}</p>
                  {r.reference_range && <p className="text-xs text-gray-400">Ref: {r.reference_range}</p>}
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${r.flag === "high" ? "text-red-600" : r.flag === "low" ? "text-blue-600" : r.flag === "critical" ? "text-purple-600" : "text-gray-900"}`}>
                    {r.result_value} {r.unit}
                  </p>
                  {r.flag && r.flag !== "normal" && (
                    <span className="text-xs font-semibold uppercase text-red-500">{r.flag}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload results form */}
      {order.status !== "resulted" && (
        <div className="card p-5 space-y-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Upload Results</p>

          {resultRows.map((row, i) => (
            <div key={i} className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
              <p className="text-sm font-semibold text-gray-700">{row.test_name}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Result value</label>
                  <input className="input" placeholder="e.g. 12.5" value={row.result_value} onChange={e => updateRow(i, "result_value", e.target.value)} />
                </div>
                <div>
                  <label className="label">Unit</label>
                  <input className="input" placeholder="e.g. g/dL" value={row.unit} onChange={e => updateRow(i, "unit", e.target.value)} />
                </div>
                <div>
                  <label className="label">Reference range</label>
                  <input className="input" placeholder="e.g. 12–16" value={row.reference_range} onChange={e => updateRow(i, "reference_range", e.target.value)} />
                </div>
                <div>
                  <label className="label">Flag</label>
                  <select className="input" value={row.flag} onChange={e => updateRow(i, "flag", e.target.value as ResultRow["flag"])}>
                    <option value="normal">Normal</option>
                    <option value="high">High ↑</option>
                    <option value="low">Low ↓</option>
                    <option value="critical">Critical ⚠</option>
                  </select>
                </div>
              </div>
            </div>
          ))}

          <div>
            <label className="label">Result PDF (optional)</label>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={e => setPdfFile(e.target.files?.[0] ?? null)}
              className="text-sm text-gray-600"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            onClick={submitResults}
            disabled={submitting}
            className="w-full py-3 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 disabled:opacity-50"
          >
            {submitting ? "Uploading…" : "Upload Results & Notify Patient"}
          </button>
        </div>
      )}
    </div>
  );
}
