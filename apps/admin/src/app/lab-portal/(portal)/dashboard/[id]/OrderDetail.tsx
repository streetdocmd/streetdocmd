"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, FileText, Phone, Upload, AlertCircle, Stethoscope, User } from "lucide-react";
import { LAB_FLOW, LAB_STATUS } from "@/components/portal/statuses";
import { Card, CardHeader, PageHeader, Spinner, StatusBadge, formatDateTime, formatNaira, ui } from "@/components/portal/ui";

interface ResultRow {
  test_name: string;
  result_value: string;
  unit: string;
  reference_range: string;
  flag: "normal" | "high" | "low" | "critical";
}

const FLAG_STYLE: Record<string, string> = {
  high: "text-red-600", low: "text-accent", critical: "text-purple-700", normal: "text-ink",
};

export default function OrderDetail({ order }: { order: any }) {
  const router = useRouter();
  const currentIdx = LAB_FLOW.indexOf(order.status);
  const nextStatus = currentIdx >= 0 ? LAB_FLOW[currentIdx + 1] : undefined;
  // "Resulted" is reached by uploading results, never by a bare status change
  const canAdvance = !!nextStatus && nextStatus !== "resulted";

  const [advancing, setAdvancing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [resultRows, setResultRows] = useState<ResultRow[]>(
    (order.tests ?? []).map((t: any) => ({
      test_name: t.test_name, result_value: "", unit: "", reference_range: "", flag: "normal" as const,
    }))
  );
  const [error, setError] = useState("");

  const existingResults: any[] = order.investigation_results ?? [];
  const pdfUrl: string | null = existingResults.find(r => r.result_pdf_url)?.result_pdf_url ?? null;
  const tests: any[] = order.tests ?? [];
  const total = tests.reduce((s, t) => s + (Number(t.price) || 0), 0);
  const status = LAB_STATUS[order.status] ?? { label: order.status, tone: "gray" as const };
  const orderedBy = order.requested_by === "patient"
    ? "Requested directly by the patient"
    : `Dr ${order.providers?.name ?? "—"}${order.providers?.credentials ? ` (${order.providers.credentials})` : ""}`;

  function updateRow(i: number, field: keyof ResultRow, value: string) {
    setResultRows(rows => rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  async function advanceStatus() {
    if (!canAdvance) return;
    setAdvancing(true);
    setError("");
    const res = await fetch(`/api/lab-portal/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setAdvancing(false);
    if (res.ok) router.refresh();
    else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't update the status. Please try again.");
    }
  }

  async function submitResults() {
    setError("");
    const missing = resultRows.filter(r => !r.result_value.trim()).map(r => r.test_name);
    if (missing.length > 0 && !pdfFile) {
      setError(`Enter a result for ${missing.join(", ")}, or attach the result report as a PDF/image.`);
      return;
    }
    setSubmitting(true);
    const formData = new FormData();
    formData.append("results", JSON.stringify(resultRows));
    if (pdfFile) formData.append("pdf", pdfFile);
    const res = await fetch(`/api/lab-portal/orders/${order.id}/results`, { method: "POST", body: formData });
    setSubmitting(false);
    if (res.ok) router.refresh();
    else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't upload the results. Please try again.");
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        back={{ href: "/lab-portal/dashboard", label: "All orders" }}
        title={order.users?.name ?? "Patient"}
        description={`Ordered ${formatDateTime(order.ordered_at)}`}
        actions={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Progress */}
          <Card>
            <CardHeader title="Progress" description={canAdvance ? "Move the order on as you work on it — the patient sees each update." : undefined} />
            <div className="p-5">
              <ol className="flex flex-wrap gap-y-2 items-center">
                {LAB_FLOW.map((s, i) => (
                  <li key={s} className="flex items-center">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
                      i < currentIdx ? "bg-green-50 text-green-700"
                      : i === currentIdx ? "bg-accent text-white"
                      : "bg-pending-bg text-muted"
                    }`}>
                      {i < currentIdx && <Check size={12} aria-hidden />}
                      {LAB_STATUS[s].label}
                    </span>
                    {i < LAB_FLOW.length - 1 && <ChevronRight size={14} className="text-line mx-0.5" aria-hidden />}
                  </li>
                ))}
              </ol>
              {canAdvance && (
                <button onClick={advanceStatus} disabled={advancing} className={`${ui.btnPrimary} mt-5`}>
                  {advancing ? <><Spinner /> Updating…</> : <>Mark as {LAB_STATUS[nextStatus!].label.toLowerCase()}</>}
                </button>
              )}
              {nextStatus === "resulted" && (
                <p className="mt-4 text-sm text-muted">Next step: upload the results below. The order is marked resulted and the patient and doctor are notified.</p>
              )}
            </div>
          </Card>

          {/* Results */}
          {existingResults.length > 0 && (
            <Card>
              <CardHeader title="Uploaded results" actions={pdfUrl && (
                <a href={pdfUrl} target="_blank" rel="noreferrer" className={`${ui.btnLink} inline-flex items-center gap-1`}>
                  <FileText size={14} aria-hidden /> View report
                </a>
              )} />
              <ul className="divide-y divide-line">
                {existingResults.map((r: any) => (
                  <li key={r.id} className="flex justify-between items-start gap-4 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-ink">{r.test_name}</p>
                      {r.reference_range && <p className="text-xs text-muted">Reference: {r.reference_range}</p>}
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${FLAG_STYLE[r.flag] ?? "text-ink"}`}>{r.result_value ?? "—"} {r.unit}</p>
                      {r.flag && r.flag !== "normal" && (
                        <StatusBadge tone={r.flag === "critical" ? "purple" : r.flag === "high" ? "red" : "blue"}>{r.flag}</StatusBadge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {order.status !== "resulted" && (
            <Card>
              <CardHeader title="Upload results" description="Enter a value for each test, attach the signed report, or both." />
              <div className="p-5 space-y-4">
                {resultRows.map((row, i) => (
                  <fieldset key={i} className="rounded-lg border border-line bg-page/60 p-4">
                    <legend className="text-sm font-semibold text-ink px-1">{row.test_name}</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                      <div>
                        <label className={ui.label}>Result</label>
                        <input className={ui.input} placeholder="e.g. 12.5" value={row.result_value} onChange={e => updateRow(i, "result_value", e.target.value)} />
                      </div>
                      <div>
                        <label className={ui.label}>Unit</label>
                        <input className={ui.input} placeholder="e.g. g/dL" value={row.unit} onChange={e => updateRow(i, "unit", e.target.value)} />
                      </div>
                      <div>
                        <label className={ui.label}>Reference range</label>
                        <input className={ui.input} placeholder="e.g. 12–16" value={row.reference_range} onChange={e => updateRow(i, "reference_range", e.target.value)} />
                      </div>
                      <div>
                        <label className={ui.label}>Flag</label>
                        <select className={ui.input} value={row.flag} onChange={e => updateRow(i, "flag", e.target.value as ResultRow["flag"])}>
                          <option value="normal">Normal</option>
                          <option value="high">High</option>
                          <option value="low">Low</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                    </div>
                  </fieldset>
                ))}

                <div>
                  <label className={ui.label}>Result report (PDF, JPG or PNG, optional)</label>
                  <label className="flex items-center gap-3 rounded-lg border border-dashed border-line px-4 py-3 cursor-pointer hover:border-accent hover:bg-accent-soft/40 transition-colors">
                    <Upload size={18} className="text-muted" aria-hidden />
                    <span className="text-sm text-muted truncate">{pdfFile ? pdfFile.name : "Choose a file"}</span>
                    <input type="file" className="sr-only" accept="application/pdf,image/jpeg,image/png"
                      onChange={e => setPdfFile(e.target.files?.[0] ?? null)} />
                  </label>
                </div>

                {error && (
                  <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3.5 py-2.5 rounded-lg">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {error}
                  </div>
                )}

                <button onClick={submitResults} disabled={submitting} className={`${ui.btnSuccess} w-full py-3`}>
                  {submitting ? <><Spinner /> Uploading…</> : "Upload results & notify patient"}
                </button>
              </div>
            </Card>
          )}
          {order.status === "resulted" && error && (
            <p role="alert" className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Patient" />
            <div className="p-5 space-y-3 text-sm">
              <p className="flex items-center gap-2 text-ink"><User size={15} className="text-muted" aria-hidden /> {order.users?.name ?? "Patient"}</p>
              {order.users?.phone && (
                <a href={`tel:${order.users.phone}`} className="flex items-center gap-2 text-accent hover:underline">
                  <Phone size={15} aria-hidden /> {order.users.phone}
                </a>
              )}
              <p className="flex items-start gap-2 text-muted"><Stethoscope size={15} className="text-muted mt-0.5 shrink-0" aria-hidden /> {orderedBy}</p>
              {order.clinical_notes && (
                <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-amber-900">
                  <p className="text-xs font-semibold mb-0.5">Clinical notes</p>
                  {order.clinical_notes}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Tests ordered" />
            <ul className="divide-y divide-line">
              {tests.map((t: any, i: number) => (
                <li key={i} className="flex justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="text-ink">{t.test_name}</span>
                  <span className="text-muted whitespace-nowrap">{formatNaira(t.price)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between px-5 py-3 border-t border-line text-sm font-semibold">
              <span>Total</span><span>{formatNaira(total)}</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
