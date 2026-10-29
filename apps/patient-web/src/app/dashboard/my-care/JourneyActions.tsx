"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, HeartPulse } from "lucide-react";
import { Button, Pill, useDialog } from "@/components/ds";

interface Request { id: string; status: "pending" | "approved" | "rejected"; review_note: string | null; created_at: string }

// The patient confirms recovery, and asks for (then downloads) their
// medical report for this care journey (migration 068)
export default function JourneyActions({ episodeId, recoveredAt, closed, requests }: {
  episodeId: string; recoveredAt: string | null; closed: boolean; requests: Request[];
}) {
  const dialog = useDialog();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function post(body: object) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/care/${episodeId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { setError((await res?.json().catch(() => ({})))?.error ?? "Couldn't save. Check your connection and try again."); return; }
    router.refresh();
  }

  async function recovered() {
    const note = await dialog.prompt({ title: "Glad you're feeling better", message: "We'll let your care team know. They'll close this care journey when everything is done.", label: "Anything you'd like them to know?", multiline: true, confirmLabel: "Confirm recovery" });
    if (note === null) return;
    post({ action: "recovered", note });
  }

  async function requestReport() {
    const reason = await dialog.prompt({ title: "Request your medical report", message: "StreetdocMD reviews each request before releasing the report. We'll let you know when it's ready.", label: "What do you need it for?", multiline: true, confirmLabel: "Send request" });
    if (reason === null) return;
    post({ action: "request_report", reason });
  }

  const pending = requests.some(r => r.status === "pending");

  return (
    <div className="mt-3 space-y-2.5 border-t border-line pt-3">
      {recoveredAt ? (
        <p className="text-ds-sm text-success">You confirmed your recovery on {new Date(recoveredAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}. Your care team will close this journey.</p>
      ) : !closed && (
        <Button size="sm" variant="secondary" onClick={recovered} disabled={busy}><HeartPulse size={16} aria-hidden /> I&apos;ve recovered</Button>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!pending && <Button size="sm" variant="ghost" onClick={requestReport} disabled={busy}><FileText size={15} aria-hidden /> Request my medical report</Button>}
        {requests.map(r => (
          <span key={r.id} className="inline-flex items-center gap-1.5 text-ds-sm">
            {r.status === "pending" && <Pill tone="idle">Report requested, waiting for approval</Pill>}
            {r.status === "rejected" && <Pill tone="bad">Report not approved{r.review_note ? `: ${r.review_note}` : ""}</Pill>}
            {r.status === "approved" && (
              <a href={`/api/care/reports/${r.id}`} className="inline-flex items-center gap-1 font-bold text-accent hover:underline">
                <Download size={14} aria-hidden /> Download medical report
              </a>
            )}
          </span>
        ))}
      </div>
      {error && <p role="alert" className="text-ds-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}
