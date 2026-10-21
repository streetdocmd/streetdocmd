"use client";
import { useState } from "react";
import Link from "next/link";
import { ClipboardList, Inbox, Truck, Clock, ChevronRight, Package, AlertTriangle, ShieldAlert } from "lucide-react";
import { useLiveRefresh } from "@/components/portal/useLiveRefresh";
import { PHARMACY_STATUS } from "@/components/portal/statuses";
import { Card, EmptyState, Notice, PageHeader, StatCard, StatusBadge, formatDateTime, formatNaira, ui } from "@/components/portal/ui";

export interface PharmacyOrderRow {
  id: string;
  status: string;
  total_amount: number;
  requires_review: boolean;
  created_at: string;
  drugs: string[];
  patient_name: string;
  source: string;
}

type Filter = "action" | "awaiting_payment" | "delivered" | "all";
const ACTION_STATUSES = ["sent", "confirmed", "dispensing", "dispatched"];

export default function PharmacyOrdersClient({ orders, loadError, partnerId, inventoryNudge, facilityName }: {
  orders: PharmacyOrderRow[];
  loadError: string | null;
  partnerId: string | null;
  inventoryNudge: { kind: "empty" | "stale"; days?: number } | null;
  facilityName: string | null;
}) {
  const [filter, setFilter] = useState<Filter>("action");
  useLiveRefresh("prescription_orders", partnerId ? `pharmacy_partner_id=eq.${partnerId}` : null);

  const needsAction = orders.filter(o => ACTION_STATUSES.includes(o.status));
  const awaitingPayment = orders.filter(o => o.status === "pending_payment");
  const delivered = orders.filter(o => o.status === "delivered");
  const newOrders = orders.filter(o => o.status === "sent");
  const outForDelivery = orders.filter(o => o.status === "dispatched");
  const visible = filter === "action" ? needsAction : filter === "awaiting_payment" ? awaitingPayment : filter === "delivered" ? delivered : orders;

  const tabs: [Filter, string, number][] = [
    ["action", "Needs action", needsAction.length],
    ["awaiting_payment", "Awaiting payment", awaitingPayment.length],
    ["delivered", "Delivered", delivered.length],
    ["all", "All", orders.length],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prescription orders"
        description={facilityName ? `Orders sent to ${facilityName}. New orders appear here automatically.` : "Orders across all partner pharmacies."}
      />

      {loadError && <Notice tone="red" icon={AlertTriangle}>{loadError}</Notice>}

      {inventoryNudge && (
        <Notice tone={inventoryNudge.kind === "empty" ? "blue" : "amber"} icon={Package}
          action={<Link href="/pharmacy-portal/inventory" className={ui.btnPrimary}>{inventoryNudge.kind === "empty" ? "Set up inventory" : "Review prices"}</Link>}>
          {inventoryNudge.kind === "empty"
            ? <><strong>Add your inventory.</strong> Patients can&apos;t buy medication from you until your stock and prices are listed. You can import a spreadsheet.</>
            : <>Your prices were last updated {inventoryNudge.days} days ago. Worth a quick check that they&apos;re still accurate.</>}
        </Notice>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="New orders" value={newOrders.length} icon={Inbox} tone="amber" hint="Need pricing" />
        <StatCard label="Awaiting payment" value={awaitingPayment.length} icon={Clock} tone="navy" hint="Priced, patient yet to pay" />
        <StatCard label="Out for delivery" value={outForDelivery.length} icon={Truck} tone="blue" hint="With your rider" />
      </div>

      <Card>
        <div className="flex gap-1 px-3 pt-3 border-b border-gray-100 overflow-x-auto" role="tablist">
          {tabs.map(([v, label, count]) => (
            <button key={v} role="tab" aria-selected={filter === v} onClick={() => setFilter(v)}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                filter === v ? "border-blue-brand text-blue-brand" : "border-transparent text-gray-500 hover:text-gray-800"
              }`}>
              {label} <span className="ml-1 text-xs text-gray-400">{count}</span>
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={orders.length === 0 ? "No orders yet" : "Nothing here"}
            description={orders.length === 0
              ? "When a StreetdocMD doctor sends a prescription to your pharmacy, or a patient orders from you, it shows up here instantly."
              : "No orders match this filter."}
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {visible.map(o => {
              const s = PHARMACY_STATUS[o.status] ?? { label: o.status, tone: "gray" as const };
              return (
                <li key={o.id}>
                  <Link href={`/pharmacy-portal/dashboard/${o.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{o.patient_name}</p>
                        <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                        {o.requires_review && <StatusBadge tone="amber" icon={ShieldAlert}>Controlled drug</StatusBadge>}
                      </div>
                      <p className="text-sm text-gray-600 truncate">{o.drugs.join(", ") || "No medications listed"}</p>
                      <p className="text-xs text-gray-400">{o.source} · {formatDateTime(o.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {o.total_amount > 0 && <p className="text-sm font-semibold text-gray-900">{formatNaira(o.total_amount)}</p>}
                    </div>
                    <ChevronRight size={18} className="text-gray-300 shrink-0" aria-hidden />
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
