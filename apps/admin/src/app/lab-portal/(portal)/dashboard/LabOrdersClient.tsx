"use client";
import { useState } from "react";
import Link from "next/link";
import { ClipboardList, FlaskConical, CheckCircle2, Inbox, ChevronRight, Microscope, AlertTriangle } from "lucide-react";
import { useLiveRefresh } from "@/components/portal/useLiveRefresh";
import { LAB_STATUS } from "@/components/portal/statuses";
import { Card, EmptyState, Notice, PageHeader, StatCard, StatusBadge, formatDateTime, ui } from "@/components/portal/ui";

export interface LabOrderRow {
  id: string;
  status: string;
  ordered_at: string;
  tests: string[];
  clinical_notes: string | null;
  patient_name: string;
  source: string;
}

type Filter = "active" | "new" | "resulted" | "all";

export default function LabOrdersClient({ orders, loadError, partnerId, activeTestCount, facilityName }: {
  orders: LabOrderRow[];
  loadError: string | null;
  partnerId: string | null;
  activeTestCount: number | null;
  facilityName: string | null;
}) {
  const [filter, setFilter] = useState<Filter>("active");
  useLiveRefresh("investigation_orders", partnerId ? `lab_partner_id=eq.${partnerId}` : null);

  const newOrders = orders.filter(o => o.status === "ordered");
  const active = orders.filter(o => o.status !== "resulted");
  const resulted = orders.filter(o => o.status === "resulted");
  const visible = filter === "new" ? newOrders : filter === "active" ? active : filter === "resulted" ? resulted : orders;

  const tabs: [Filter, string, number][] = [
    ["active", "In progress", active.length],
    ["new", "New", newOrders.length],
    ["resulted", "Resulted", resulted.length],
    ["all", "All", orders.length],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investigation orders"
        description={facilityName ? `Lab orders sent to ${facilityName}. New orders appear here automatically.` : "Lab orders across all partner labs."}
      />

      {loadError && <Notice tone="red" icon={AlertTriangle}>{loadError}</Notice>}

      {activeTestCount === 0 && (
        <Notice tone="blue" icon={Microscope}
          action={<Link href="/lab-portal/tests" className={ui.btnPrimary}>Set up test menu</Link>}>
          <strong>Add your test menu.</strong> Doctors can only order tests from labs that have published their tests and prices.
        </Notice>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="New orders" value={newOrders.length} icon={Inbox} tone="amber" hint="Waiting to be confirmed" />
        <StatCard label="In progress" value={active.length} icon={FlaskConical} tone="blue" hint="Not yet resulted" />
        <StatCard label="Resulted" value={resulted.length} icon={CheckCircle2} tone="green" hint="Results delivered" />
      </div>

      <Card>
        <div className="flex gap-1 px-3 pt-3 border-b border-line overflow-x-auto" role="tablist">
          {tabs.map(([v, label, count]) => (
            <button key={v} role="tab" aria-selected={filter === v} onClick={() => setFilter(v)}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                filter === v ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"
              }`}>
              {label} <span className="ml-1 text-xs text-muted">{count}</span>
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={orders.length === 0 ? "No orders yet" : "Nothing here"}
            description={orders.length === 0
              ? "When a StreetdocMD doctor or patient orders tests from your lab, the order shows up here instantly."
              : "No orders match this filter."}
          />
        ) : (
          <ul className="divide-y divide-line">
            {visible.map(o => {
              const s = LAB_STATUS[o.status] ?? { label: o.status, tone: "gray" as const };
              return (
                <li key={o.id}>
                  <Link href={`/lab-portal/dashboard/${o.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-page transition-colors">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-ink">{o.patient_name}</p>
                        <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                      </div>
                      <p className="text-sm text-muted truncate">{o.tests.join(", ") || "No tests listed"}</p>
                      <p className="text-xs text-muted">{o.source} · {formatDateTime(o.ordered_at)}</p>
                    </div>
                    <ChevronRight size={18} className="text-line shrink-0" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
