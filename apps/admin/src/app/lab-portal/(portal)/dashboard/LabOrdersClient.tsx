"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, ChevronRight, Microscope, AlertTriangle } from "lucide-react";
import { useLiveRefresh } from "@/components/portal/useLiveRefresh";
import { LAB_FLOW, LAB_STATUS } from "@/components/portal/statuses";
import { Card, EmptyState, Notice, PageHeader, StatusBadge, formatDateTime, ui } from "@/components/portal/ui";
import { Button, SegmentedControl } from "@/components/ds";

export interface LabOrderRow {
  id: string;
  status: string;
  ordered_at: string;
  tests: string[];
  clinical_notes: string | null;
  patient_name: string;
  source: string;
}

// The design's three queues, over the six order statuses
type Queue = "collect" | "processing" | "ready";
const QUEUE_OF: Record<string, Queue> = {
  ordered: "collect",
  confirmed: "collect",
  sample_collector_dispatched: "collect",
  sample_collected: "processing",
  processing: "processing",
  resulted: "ready",
};

// One tap moves an order a step on; results are uploaded on the order page
const NEXT_ACTION: Record<string, string> = {
  ordered: "Confirm order",
  confirmed: "Collector sent",
  sample_collector_dispatched: "Mark collected",
  sample_collected: "Start processing",
};

export default function LabOrdersClient({ orders, loadError, partnerId, activeTestCount, facilityName }: {
  orders: LabOrderRow[];
  loadError: string | null;
  partnerId: string | null;
  activeTestCount: number | null;
  facilityName: string | null;
}) {
  const router = useRouter();
  const [queue, setQueue] = useState<Queue>("collect");
  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState("");
  useLiveRefresh("investigation_orders", partnerId ? `lab_partner_id=eq.${partnerId}` : null);

  const count = (q: Queue) => orders.filter(o => QUEUE_OF[o.status] === q).length;
  const visible = orders.filter(o => QUEUE_OF[o.status] === queue);

  async function advance(o: LabOrderRow) {
    const next = LAB_FLOW[LAB_FLOW.indexOf(o.status) + 1];
    if (!next) return;
    setBusy(o.id);
    setRowError("");
    const res = await fetch(`/api/lab-portal/orders/${o.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setRowError(b.error ?? "Couldn't update the order. Please try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description={facilityName ? `Tests ordered from ${facilityName}. New orders appear here automatically.` : "Lab orders across all partner labs."}
      />

      {loadError && <Notice tone="red" icon={AlertTriangle}>{loadError}</Notice>}

      {activeTestCount === 0 ? (
        <Notice tone="blue" icon={Microscope}
          action={<Link href="/lab-portal/tests" className={ui.btnPrimary}>Set up your price list</Link>}>
          <strong>Add your tests and prices.</strong> Doctors can only order from labs that have published their tests.
        </Notice>
      ) : activeTestCount != null && (
        <Card className="flex items-center justify-between gap-3 p-4">
          <div>
            <b className="block text-ds-sm text-ink">Your price list</b>
            <small className="text-ds-xs text-muted">{activeTestCount} {activeTestCount === 1 ? "test" : "tests"} on. Doctors and patients see these prices.</small>
          </div>
          <Button href="/lab-portal/tests" variant="secondary" size="sm">Edit prices</Button>
        </Card>
      )}

      <SegmentedControl<Queue>
        label="Queue"
        value={queue}
        onChange={setQueue}
        className="max-w-md"
        options={[
          { value: "collect", label: `To collect · ${count("collect")}` },
          { value: "processing", label: `Processing · ${count("processing")}` },
          { value: "ready", label: `Ready · ${count("ready")}` },
        ]}
      />

      {rowError && <p role="alert" className="text-ds-sm font-semibold text-danger">{rowError}</p>}

      <Card>
        {visible.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={orders.length === 0 ? "No orders yet" : "Nothing waiting here"}
            description={orders.length === 0
              ? "When a StreetdocMD doctor or patient orders tests from your lab, the order shows up here instantly."
              : undefined}
          />
        ) : (
          <ul className="px-4 sm:px-5">
            {visible.map(o => {
              const s = LAB_STATUS[o.status] ?? { label: o.status, tone: "gray" as const };
              const action = NEXT_ACTION[o.status];
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-3 border-b border-line py-3.5 last:border-0">
                  <Link href={`/lab-portal/dashboard/${o.id}`} className="group min-w-0 flex-1">
                    <b className="block text-ds-control text-ink group-hover:text-accent">{o.tests.join(", ") || "No tests listed"}</b>
                    <small className="block text-ds-xs text-muted">{o.patient_name} · {o.source} · {formatDateTime(o.ordered_at)}</small>
                    <span className="mt-1.5 inline-block"><StatusBadge tone={s.tone}>{s.label}</StatusBadge></span>
                  </Link>
                  {partnerId && action ? (
                    <Button size="sm" variant="secondary" disabled={busy === o.id} onClick={() => advance(o)}>
                      {busy === o.id ? "Saving…" : action}
                    </Button>
                  ) : partnerId && o.status === "processing" ? (
                    <Button size="sm" variant="secondary" href={`/lab-portal/dashboard/${o.id}`}>Upload result</Button>
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
