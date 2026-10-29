"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Button, Pill, SegmentedControl, useDialog } from "@/components/ds";

export interface ReportRequest {
  id: string;
  episodeId: string;
  requester: string;
  role: "patient" | "provider";
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  note: string | null;
  createdAt: string;
  journey: string;
}

type Filter = "pending" | "decided";
const when = (iso: string) => new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function ReportsClient({ requests }: { requests: ReportRequest[] }) {
  const dialog = useDialog();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const shown = requests.filter(r => (filter === "pending" ? r.status === "pending" : r.status !== "pending"));

  async function decide(r: ReportRequest, decision: "approve" | "reject") {
    let note = "";
    if (decision === "reject") {
      note = (await dialog.prompt({ title: "Refuse this request?", message: "The requester will see your reason.", label: "Reason", required: true, multiline: true, confirmLabel: "Refuse", tone: "danger" })) ?? "";
      if (!note) return;
    } else if (!(await dialog.confirm({ title: `Release the report to ${r.requester}?`, message: r.role === "patient" ? "They get the medical report, without the care team chat." : "They get the full report, including the care team chat.", confirmLabel: "Release" }))) {
      return;
    }
    setBusy(r.id);
    setError("");
    const res = await fetch(`/api/admin/reports/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, note }),
    });
    setBusy(null);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "Couldn't save the decision."); return; }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-navy">Medical reports</h1>
        <p className="mt-1 text-sm text-muted">
          Patients and providers can ask for a care journey&apos;s report. Approving releases a PDF to the requester; a patient&apos;s copy leaves out the care team chat.
        </p>
      </div>
      <SegmentedControl<Filter> label="Show" value={filter} onChange={setFilter} className="max-w-xs"
        options={[{ value: "pending", label: `Waiting · ${requests.filter(r => r.status === "pending").length}` }, { value: "decided", label: "Decided" }]} />
      {error && <p role="alert" className="rounded-ds-sm bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
      {shown.length === 0 ? (
        <div className="rounded-ds-lg border border-line bg-surface p-12 text-center">
          <FileText size={22} className="mx-auto mb-2 text-muted" aria-hidden />
          <p className="font-semibold text-ink">No requests here</p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-ds-lg border border-line bg-surface">
          {shown.map(r => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <b className="block text-sm text-ink">{r.journey}</b>
                <small className="block text-xs text-muted">Requested by {r.requester} ({r.role}) · {when(r.createdAt)}</small>
                {r.reason && <small className="mt-0.5 block text-xs text-ink/80">&ldquo;{r.reason}&rdquo;</small>}
                {r.status !== "pending" && (
                  <div className="mt-1.5"><Pill tone={r.status === "approved" ? "ok" : "bad"}>{r.status === "approved" ? "Released" : "Refused"}{r.note ? `: ${r.note}` : ""}</Pill></div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/dashboard/journeys/${r.episodeId}`} className="inline-flex min-h-9 items-center rounded-pill px-3 text-sm font-bold text-accent hover:underline">Review journey</Link>
                {r.status === "pending" && (
                  <>
                    <Button size="sm" disabled={busy === r.id} onClick={() => decide(r, "approve")}>{busy === r.id ? "Working…" : "Approve and release"}</Button>
                    <Button size="sm" variant="danger-outline" disabled={busy === r.id} onClick={() => decide(r, "reject")}>Refuse</Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
