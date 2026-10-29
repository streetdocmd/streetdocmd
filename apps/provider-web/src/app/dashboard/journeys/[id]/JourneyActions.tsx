"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { Button, Pill, useDialog } from "@/components/ds";

interface Request { id: string; status: "pending" | "approved" | "rejected"; review_note: string | null; created_at: string }

// Close the journey, and request or download its report
export default function JourneyActions({ episodeId, closed, recovered, requests }: {
  episodeId: string; closed: boolean; recovered: boolean; requests: Request[];
}) {
  const dialog = useDialog();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function post(body: object) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/journeys/${episodeId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { setError((await res?.json().catch(() => ({})))?.error ?? "Couldn't save. Check your connection and try again."); return; }
    router.refresh();
  }

  async function close() {
    if (!(await dialog.confirm({
      title: "Close this care journey?",
      message: recovered ? "The chat becomes read only." : "The patient hasn't confirmed they've recovered yet. The chat becomes read only.",
      confirmLabel: "Close journey",
      tone: recovered ? "default" : "danger",
    }))) return;
    post({ action: "close" });
  }

  async function requestReport() {
    const reason = await dialog.prompt({ title: "Request the report", message: "StreetdocMD reviews each request before releasing it.", label: "Why do you need it?", multiline: true, confirmLabel: "Send request" });
    if (reason === null) return;
    post({ action: "request_report", reason });
  }

  const pending = requests.some(r => r.status === "pending");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {!closed && <Button size="sm" variant={recovered ? "primary" : "secondary"} onClick={close} disabled={busy}>Close journey</Button>}
        {!pending && <Button size="sm" variant="secondary" onClick={requestReport} disabled={busy}><FileText size={15} aria-hidden /> Request report</Button>}
      </div>
      {requests.length > 0 && (
        <ul className="space-y-1.5">
          {requests.map(r => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 text-ds-sm">
              <span className="text-muted">Report requested {new Date(r.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</span>
              {r.status === "pending" && <Pill tone="idle">Waiting for approval</Pill>}
              {r.status === "rejected" && <Pill tone="bad">Not approved{r.review_note ? `: ${r.review_note}` : ""}</Pill>}
              {r.status === "approved" && (
                <a href={`/api/journeys/reports/${r.id}`} className="inline-flex items-center gap-1 font-bold text-accent hover:underline">
                  <Download size={14} aria-hidden /> Download
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-ds-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}
