"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, ClipboardList, Clock, Microscope } from "lucide-react";
import { useLiveRefresh } from "@/components/portal/useLiveRefresh";
import { LAB_STATUS } from "@/components/portal/statuses";
import { Card, EmptyState, Notice, PageHeader, StatusBadge, formatDateTime, ui } from "@/components/portal/ui";
import { Button, SegmentedControl } from "@/components/ds";
import { WINDOW_LABEL } from "@/lib/investigation-status";

export interface LabOrderRow {
  id: string;
  status: string;
  ordered_at: string;
  tests: string[];
  patient_name: string;
  source: string;
  doctor_collected: boolean;
  deadline: string | null;
  preferred_date: string | null;
  preferred_window: string | null;
  scheduled_at: string | null;
  critical: boolean;
}

// Queues over the shared investigation statuses (migration 067)
type Queue = "new" | "collect" | "processing" | "done";
const QUEUE_OF: Record<string, Queue> = {
  lab_requested: "new",
  lab_accepted: "collect",
  collection_scheduled: "collect",
  sample_collected: "processing",
  in_transit: "processing",
  received_at_lab: "processing",
  analysis_in_progress: "processing",
  results_uploaded: "done",
  doctor_review_pending: "done",
  reviewed: "done",
  follow_up_required: "done",
  completed: "done",
};

function minutesLeft(deadline: string | null, now: number) {
  if (!deadline) return null;
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 60000));
}

export default function LabOrdersClient({ orders, loadError, partnerId, activeTestCount, facilityName }: {
  orders: LabOrderRow[];
  loadError: string | null;
  partnerId: string | null;
  activeTestCount: number | null;
  facilityName: string | null;
}) {
  const router = useRouter();
  const count = (q: Queue) => orders.filter(o => QUEUE_OF[o.status] === q).length;
  const [queue, setQueue] = useState<Queue>(count("new") > 0 ? "new" : "collect");
  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useLiveRefresh("investigation_orders", partnerId ? `lab_partner_id=eq.${partnerId}` : null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const visible = orders.filter(o => QUEUE_OF[o.status] === queue);

  async function respond(o: LabOrderRow, accept: boolean) {
    let reason = "";
    if (!accept) {
      reason = prompt("Why can't you take this order? (for example: a test is unavailable today)")?.trim() ?? "";
      if (!reason) return;
    }
    setBusy(o.id);
    setRowError("");
    const res = await fetch(`/api/lab-portal/orders/${o.id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept, reason }),
    });
    setBusy(null);
    if (!res.ok) {
      setRowError((await res.json().catch(() => ({}))).error ?? "Couldn't save your answer. Please try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description={facilityName ? `Tests requested from ${facilityName}. New requests appear here automatically.` : "Lab orders across all partner labs."}
      />

      {loadError && <Notice tone="red" icon={AlertTriangle}>{loadError}</Notice>}

      {activeTestCount === 0 ? (
        <Notice tone="blue" icon={Microscope}
          action={<Link href="/lab-portal/tests" className={ui.btnPrimary}>Set up your price list</Link>}>
          <strong>Add your tests and prices.</strong> Patients and doctors can only be matched to labs that list the tests they need.
        </Notice>
      ) : activeTestCount != null && (
        <Card className="flex items-center justify-between gap-3 p-4">
          <div>
            <b className="block text-ds-sm text-ink">Your price list</b>
            <small className="text-ds-xs text-muted">
              {activeTestCount} {activeTestCount === 1 ? "test" : "tests"} on. Switch a test off when you can&apos;t do it, so you aren&apos;t sent orders you&apos;d decline.
            </small>
          </div>
          <Button href="/lab-portal/tests" variant="secondary" size="sm">Edit prices</Button>
        </Card>
      )}

      <SegmentedControl<Queue>
        label="Queue"
        value={queue}
        onChange={setQueue}
        className="max-w-xl"
        options={[
          { value: "new", label: `New · ${count("new")}` },
          { value: "collect", label: `To collect · ${count("collect")}` },
          { value: "processing", label: `Processing · ${count("processing")}` },
          { value: "done", label: `Done · ${count("done")}` },
        ]}
      />

      {rowError && <p role="alert" className="text-ds-sm font-semibold text-danger">{rowError}</p>}

      <Card>
        {visible.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={orders.length === 0 ? "No orders yet" : "Nothing waiting here"}
            description={orders.length === 0 ? "Paid test requests from StreetdocMD patients and doctors appear here." : undefined}
          />
        ) : (
          <ul className="px-4 sm:px-5">
            {visible.map(o => {
              const s = LAB_STATUS[o.status] ?? { label: o.status, tone: "gray" as const };
              const left = o.status === "lab_requested" ? minutesLeft(o.deadline, now) : null;
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-3 border-b border-line py-3.5 last:border-0">
                  <Link href={`/lab-portal/dashboard/${o.id}`} className="group min-w-0 flex-1">
                    <b className="block text-ds-control text-ink group-hover:text-accent">{o.tests.join(", ") || "No tests listed"}</b>
                    <small className="block text-ds-xs text-muted">
                      {o.patient_name} · {o.source} · {formatDateTime(o.ordered_at)}
                    </small>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                      {o.critical && <StatusBadge tone="red">Critical result</StatusBadge>}
                      {o.doctor_collected && <StatusBadge tone="navy">Sample taken by the doctor</StatusBadge>}
                      {!o.doctor_collected && o.status === "lab_accepted" && o.preferred_date && (
                        <small className="text-ds-xs text-muted">
                          Patient asked for {new Date(`${o.preferred_date}T00:00:00`).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}, {WINDOW_LABEL[o.preferred_window ?? ""] ?? ""}
                        </small>
                      )}
                      {o.status === "collection_scheduled" && o.scheduled_at && (
                        <small className="text-ds-xs text-muted">Collect {formatDateTime(o.scheduled_at)}</small>
                      )}
                    </span>
                  </Link>
                  {o.status === "lab_requested" && partnerId ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {left != null && (
                        <span className={`inline-flex items-center gap-1 text-ds-xs font-bold ${left <= 10 ? "text-danger" : "text-muted"}`}>
                          <Clock size={13} aria-hidden /> {left} min left
                        </span>
                      )}
                      <Button size="sm" disabled={busy === o.id} onClick={() => respond(o, true)}>Accept</Button>
                      <Button size="sm" variant="secondary" disabled={busy === o.id} onClick={() => respond(o, false)}>Decline</Button>
                    </div>
                  ) : (
                    <ChevronRight size={18} className="text-muted" aria-hidden />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
