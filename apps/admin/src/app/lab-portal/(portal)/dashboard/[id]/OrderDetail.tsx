"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarClock, FileText, MapPin, Phone, Stethoscope, Upload, User } from "lucide-react";
import { LAB_NEXT, LAB_STATUS } from "@/components/portal/statuses";
import { Card, CardHeader, PageHeader, Spinner, StatusBadge, formatDateTime, formatNaira, ui } from "@/components/portal/ui";
import { Button } from "@/components/ds";
import { RESULT_STATUSES, WINDOW_LABEL, statusOf } from "@/lib/investigation-status";

interface ResultRow {
  test_name: string;
  result_value: string;
  unit: string;
  reference_range: string;
  flag: "normal" | "high" | "low" | "critical";
}

const FLAG_STYLE: Record<string, string> = {
  high: "text-danger", low: "text-accent", critical: "text-danger", normal: "text-ink",
};

const ROLE: Record<string, string> = { patient: "Patient", doctor: "Doctor", lab: "Lab", admin: "StreetdocMD", system: "StreetdocMD" };

export default function OrderDetail({ order, events, canAct }: { order: any; events: any[]; canAct: boolean }) {
  const router = useRouter();
  const next = LAB_NEXT[order.status];
  const doctorCollected = order.collection_method === "doctor";
  const hasResults = (RESULT_STATUSES as string[]).includes(order.status);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scheduleAt, setScheduleAt] = useState(() => {
    const base = order.preferred_date ? new Date(`${order.preferred_date}T${order.preferred_window === "afternoon" ? "13" : order.preferred_window === "evening" ? "16" : "09"}:00:00`) : new Date(Date.now() + 3_600_000);
    return new Date(base.getTime() - base.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [collection, setCollection] = useState({ identity: false, by: "", notes: "" });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [resultRows, setResultRows] = useState<ResultRow[]>(
    (order.tests ?? []).map((t: any) => ({ test_name: t.test_name, result_value: "", unit: "", reference_range: "", flag: "normal" as const })),
  );

  const existingResults: any[] = order.investigation_results ?? [];
  const hasReport = existingResults.some(r => r.result_pdf_url);
  const tests: any[] = order.tests ?? [];
  const labTotal = order.lab_price_total ?? tests.reduce((s, t) => s + (Number(t.price) || 0), 0);
  const status = LAB_STATUS[order.status] ?? { label: statusOf(order.status).label, tone: "gray" as const };
  const orderedBy = order.requested_by === "patient"
    ? "Requested directly by the patient"
    : `Dr ${order.providers?.name ?? ""}${order.providers?.credentials ? ` (${order.providers.credentials})` : ""}`;
  const ext = order.external_request as { doctor?: string; facility?: string; notes?: string; file_path?: string } | null;

  async function send(url: string, init: RequestInit) {
    setBusy(true);
    setError("");
    const res = await fetch(url, init).catch(() => null);
    setBusy(false);
    if (res?.ok) { router.refresh(); return true; }
    setError((await res?.json().catch(() => ({})))?.error ?? "Couldn't save. Check your connection and try again.");
    return false;
  }

  function respond(accept: boolean) {
    let reason = "";
    if (!accept) {
      reason = prompt("Why can't you take this order? (for example: a test is unavailable today)")?.trim() ?? "";
      if (!reason) return;
    }
    send(`/api/lab-portal/orders/${order.id}/respond`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accept, reason }),
    });
  }

  function advance(to: string, extra: object = {}) {
    send(`/api/lab-portal/orders/${order.id}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: to, ...extra }),
    });
  }

  function submitResults() {
    const missing = resultRows.filter(r => !r.result_value.trim()).map(r => r.test_name);
    if (missing.length > 0 && !pdfFile) {
      setError(`Enter a result for ${missing.join(", ")}, or attach the result report.`);
      return;
    }
    const formData = new FormData();
    formData.append("results", JSON.stringify(resultRows));
    if (pdfFile) formData.append("pdf", pdfFile);
    send(`/api/lab-portal/orders/${order.id}/results`, { method: "POST", body: formData });
  }

  const updateRow = (i: number, field: keyof ResultRow, value: string) =>
    setResultRows(rows => rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        back={{ href: "/lab-portal/dashboard", label: "All orders" }}
        title={order.users?.name ?? "Patient"}
        description={`Ordered ${formatDateTime(order.ordered_at)}`}
        actions={<>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          {order.care_episode_id && order.status !== "lab_requested" && (
            <a href={`/lab-portal/journeys/${order.care_episode_id}`} className={`${ui.btnSecondary} min-h-9`}>Care team chat</a>
          )}
        </>}
      />

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-ds-sm bg-danger-bg px-3.5 py-2.5 text-ds-sm font-semibold text-danger">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* What to do now */}
          {canAct && order.status === "lab_requested" && (
            <Card className="space-y-3 p-5">
              <p className="font-bold text-navy">New request</p>
              <p className="text-ds-sm text-muted">
                Accept if you can do every test{doctorCollected ? "" : " and collect at the patient's address"}. If you don&apos;t answer within 30 minutes, it moves to another lab.
                {order.lab_deadline && ` Answer by ${formatDateTime(order.lab_deadline)}.`}
              </p>
              <div className="flex gap-2">
                <Button disabled={busy} onClick={() => respond(true)}>Accept</Button>
                <Button variant="secondary" disabled={busy} onClick={() => respond(false)}>Decline</Button>
              </div>
            </Card>
          )}

          {canAct && order.status === "lab_accepted" && doctorCollected && (
            <Card className="space-y-3 p-5">
              <p className="font-bold text-navy">Pick up the sample</p>
              <p className="text-ds-sm text-muted">The doctor took the sample during the visit{order.collected_at ? ` (${formatDateTime(order.collected_at)})` : ""}. Arrange the handover, then confirm here.</p>
              <Button disabled={busy} onClick={() => advance("sample_collected")}>Sample handed over to us</Button>
            </Card>
          )}

          {canAct && next?.needs === "schedule" && !doctorCollected && (
            <Card className="space-y-3 p-5">
              <p className="font-bold text-navy">Book the home collection</p>
              {order.preferred_date && (
                <p className="text-ds-sm text-muted">
                  The patient asked for {new Date(`${order.preferred_date}T00:00:00`).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}, {WINDOW_LABEL[order.preferred_window] ?? ""}.
                </p>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label htmlFor="sched" className={ui.label}>Collector arrives</label>
                  <input id="sched" type="datetime-local" className={ui.input} value={scheduleAt} onChange={e => setScheduleAt(e.target.value)} />
                </div>
                <Button disabled={busy || !scheduleAt} onClick={() => advance("collection_scheduled", { scheduled_at: new Date(scheduleAt).toISOString() })}>Book collection</Button>
              </div>
            </Card>
          )}

          {canAct && order.status === "collection_scheduled" && (
            <Card className="space-y-3 p-5">
              <p className="font-bold text-navy">Record the collection</p>
              <p className="text-ds-sm text-muted">Booked for {formatDateTime(order.collection_scheduled_at)}. Before taking the sample, check the patient&apos;s name and date of birth against this order.</p>
              <label className="flex items-start gap-2 text-ds-sm text-ink">
                <input type="checkbox" className={`${ui.checkbox} mt-0.5`} checked={collection.identity} onChange={e => setCollection(c => ({ ...c, identity: e.target.checked }))} />
                I confirmed the patient&apos;s identity{order.users?.dob ? ` (born ${new Date(order.users.dob).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })})` : ""} and labelled the sample with this order
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="by" className={ui.label}>Collected by</label>
                  <input id="by" className={ui.input} value={collection.by} onChange={e => setCollection(c => ({ ...c, by: e.target.value }))} placeholder="Collector's name" />
                </div>
                <div>
                  <label htmlFor="notes" className={ui.label}>Sample notes (optional)</label>
                  <input id="notes" className={ui.input} value={collection.notes} onChange={e => setCollection(c => ({ ...c, notes: e.target.value }))} placeholder="e.g. 2 tubes, fasting confirmed" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy || !collection.identity || !collection.by.trim()}
                  onClick={() => advance("sample_collected", { identity_checked: collection.identity, collected_by: collection.by, sample_notes: collection.notes })}>
                  Sample collected
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => {
                  const when = prompt("New collection time (YYYY-MM-DD HH:MM)", scheduleAt.replace("T", " "));
                  if (when) advance("collection_scheduled", { scheduled_at: new Date(when.replace(" ", "T")).toISOString() });
                }}>Rebook</Button>
              </div>
            </Card>
          )}

          {canAct && order.status === "sample_collected" && (
            <Card className="flex flex-wrap items-center gap-2 p-5">
              <p className="w-full font-bold text-navy">Sample collected{order.collected_by ? ` by ${order.collected_by}` : ""}</p>
              <Button variant="secondary" disabled={busy} onClick={() => advance("in_transit")}>On the way to the lab</Button>
              <Button disabled={busy} onClick={() => advance("received_at_lab")}>Received at the lab</Button>
            </Card>
          )}

          {canAct && (order.status === "in_transit" || order.status === "received_at_lab") && next && (
            <Card className="flex flex-wrap items-center gap-2 p-5">
              <p className="w-full font-bold text-navy">{statusOf(order.status).label}</p>
              <Button disabled={busy} onClick={() => advance(next.to)}>{next.action}</Button>
            </Card>
          )}

          {/* Results */}
          {existingResults.length > 0 && (
            <Card>
              <CardHeader title="Uploaded results" actions={hasReport && (
                <a href={`/api/lab-portal/orders/${order.id}/file?kind=report`} target="_blank" rel="noreferrer" className={`${ui.btnLink} inline-flex items-center gap-1`}>
                  <FileText size={14} aria-hidden /> View report
                </a>
              )} />
              <ul className="divide-y divide-line">
                {existingResults.map((r: any) => (
                  <li key={r.id} className="flex items-start justify-between gap-4 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-ink">{r.test_name}</p>
                      {r.reference_range && <p className="text-xs text-muted">Reference: {r.reference_range}</p>}
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${FLAG_STYLE[r.flag] ?? "text-ink"}`}>{r.result_value ?? "See report"} {r.unit}</p>
                      {r.flag && r.flag !== "normal" && <StatusBadge tone={r.flag === "critical" ? "red" : "amber"}>{r.flag}</StatusBadge>}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {canAct && order.status === "analysis_in_progress" && (
            <Card>
              <CardHeader title="Upload results" description="Enter a value for each test, attach the signed report, or both. Mark anything that needs urgent attention as critical." />
              <div className="space-y-4 p-5">
                {resultRows.map((row, i) => (
                  <fieldset key={i} className="rounded-lg border border-line bg-page/60 p-4">
                    <legend className="px-1 text-sm font-semibold text-ink">{row.test_name}</legend>
                    <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div><label className={ui.label}>Result</label><input className={ui.input} placeholder="e.g. 12.5" value={row.result_value} onChange={e => updateRow(i, "result_value", e.target.value)} /></div>
                      <div><label className={ui.label}>Unit</label><input className={ui.input} placeholder="e.g. g/dL" value={row.unit} onChange={e => updateRow(i, "unit", e.target.value)} /></div>
                      <div><label className={ui.label}>Reference range</label><input className={ui.input} placeholder="e.g. 12 to 16" value={row.reference_range} onChange={e => updateRow(i, "reference_range", e.target.value)} /></div>
                      <div>
                        <label className={ui.label}>Flag</label>
                        <select className={ui.input} value={row.flag} onChange={e => updateRow(i, "flag", e.target.value as ResultRow["flag"])}>
                          <option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option><option value="critical">Critical</option>
                        </select>
                      </div>
                    </div>
                  </fieldset>
                ))}
                <div>
                  <label className={ui.label}>Result report (PDF, JPG or PNG, optional)</label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line px-4 py-3 transition-colors hover:border-accent hover:bg-accent-soft/40">
                    <Upload size={18} className="text-muted" aria-hidden />
                    <span className="truncate text-sm text-muted">{pdfFile ? pdfFile.name : "Choose a file"}</span>
                    <input type="file" className="sr-only" accept="application/pdf,image/jpeg,image/png" onChange={e => setPdfFile(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
                <button onClick={submitResults} disabled={busy} className={`${ui.btnSuccess} w-full py-3`}>
                  {busy ? <><Spinner /> Uploading…</> : "Upload results and notify"}
                </button>
                <p className="text-ds-xs text-muted">Results are stored privately. Notifications tell the patient{order.requested_by === "provider" ? " and doctor" : ""} results are ready without including any values.</p>
              </div>
            </Card>
          )}

          {hasResults && existingResults.length === 0 && (
            <p className="text-ds-sm text-muted">Results were sent.</p>
          )}

          {/* History */}
          <Card>
            <CardHeader title="History" />
            <ol className="divide-y divide-line">
              {events.map((e, i) => (
                <li key={i} className="flex items-start justify-between gap-3 px-5 py-2.5 text-sm">
                  <span>
                    <b className="text-ink">{e.to_status ? statusOf(e.to_status).label : "Update"}</b>
                    <span className="text-muted"> · {ROLE[e.actor_role] ?? e.actor_role}</span>
                    {e.note && <span className="block text-xs text-muted">{e.note}</span>}
                  </span>
                  <span className="whitespace-nowrap text-xs text-muted">{formatDateTime(e.created_at)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Patient" />
            <div className="space-y-3 p-5 text-sm">
              <p className="flex items-center gap-2 text-ink"><User size={15} className="text-muted" aria-hidden /> {order.users?.name ?? "Patient"}</p>
              {order.contact_phone && (
                <a href={`tel:${order.contact_phone}`} className="flex items-center gap-2 text-accent hover:underline"><Phone size={15} aria-hidden /> {order.contact_phone}</a>
              )}
              {order.collection_address && (
                <p className="flex items-start gap-2 text-ink"><MapPin size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden /> {order.collection_address}</p>
              )}
              {order.status === "lab_requested" && <p className="text-xs text-muted">Contact details and the address appear once you accept.</p>}
              {order.collection_scheduled_at && (
                <p className="flex items-center gap-2 text-ink"><CalendarClock size={15} className="text-muted" aria-hidden /> {formatDateTime(order.collection_scheduled_at)}</p>
              )}
              <p className="flex items-start gap-2 text-muted"><Stethoscope size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden /> {orderedBy}</p>
              {order.clinical_notes && (
                <div className="rounded-lg bg-warn-bg p-3 text-ink">
                  <p className="mb-0.5 text-xs font-semibold">Clinical notes</p>
                  {order.clinical_notes}
                </div>
              )}
              {ext && (
                <div className="rounded-lg bg-page p-3 text-ink">
                  <p className="mb-0.5 text-xs font-semibold">Outside doctor&apos;s request</p>
                  {[ext.doctor, ext.facility].filter(Boolean).join(" · ")}
                  {ext.notes && <span className="block text-xs text-muted">{ext.notes}</span>}
                  {ext.file_path && order.status !== "lab_requested" && (
                    <a href={`/api/lab-portal/orders/${order.id}/file?kind=request`} target="_blank" rel="noreferrer" className="mt-1 block text-xs font-bold text-accent hover:underline">Open the request</a>
                  )}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Tests" />
            <ul className="divide-y divide-line">
              {tests.map((t: any, i: number) => (
                <li key={i} className="px-5 py-2.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-ink">{t.test_name}</span>
                    <span className="whitespace-nowrap text-muted">{t.price != null ? formatNaira(t.price) : ""}</span>
                  </div>
                  {t.preparation && <span className="block text-xs text-muted">{t.preparation}</span>}
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t border-line px-5 py-3 text-sm font-semibold">
              <span>You receive</span><span>{formatNaira(Number(labTotal) + Number(order.collection_fee ?? 0))}</span>
            </div>
            {doctorCollected && <p className="px-5 pb-3 text-xs text-muted">No collection fee: the doctor took the sample.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
