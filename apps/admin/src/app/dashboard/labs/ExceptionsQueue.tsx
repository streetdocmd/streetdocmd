"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button, useDialog } from "@/components/ds";
import { formatNaira } from "@/lib/shared";

// Paid investigation orders no lab could take (status "exception", migration
// 067). Operations can try the matching again, or cancel the order and mark
// the payment as due for a refund in Finance.
export default function ExceptionsQueue({ orders }: { orders: any[] }) {
  const dialog = useDialog();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function act(id: string, action: "reassign" | "cancel") {
    const note = action === "cancel"
      ? await dialog.prompt({ title: "Cancel and refund?", message: "The patient's payment will be marked as due for a refund in Finance.", label: "Reason", required: true, confirmLabel: "Cancel order", tone: "danger" })
      : "";
    if (action === "cancel" && !note) return;
    setBusy(id);
    setError("");
    const res = await fetch(`/api/labs/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    setBusy(null);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "Couldn't update the order."); return; }
    router.refresh();
  }

  if (orders.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={18} className="text-danger" aria-hidden />
        <h2 className="text-lg font-bold text-navy">Needs attention</h2>
        <span className="rounded-pill bg-danger px-2 py-0.5 text-xs font-bold text-white">{orders.length}</span>
      </div>
      <p className="text-sm text-muted">Paid test orders that no partner lab accepted. Call the patient, then try matching again (for example after a lab has switched a test back on) or cancel and refund.</p>
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      <div className="divide-y divide-line overflow-hidden rounded-ds-lg border border-line bg-surface">
        {orders.map(o => (
          <div key={o.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <b className="block text-sm text-ink">{(o.tests ?? []).map((t: any) => t.test_name).join(", ")}</b>
              <small className="block text-xs text-muted">
                {o.users?.name ?? "Patient"}{o.users?.phone ? ` · ${o.users.phone}` : ""} · {o.collection_address ?? "No address"} · paid {formatNaira(Number(o.amount_paid ?? 0))} · {o.lab_attempts} lab{o.lab_attempts === 1 ? "" : "s"} tried
              </small>
              {o.exception_reason && <small className="mt-0.5 block text-xs text-danger">{o.exception_reason}</small>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={busy === o.id} onClick={() => act(o.id, "reassign")}>Try labs again</Button>
              <Button size="sm" variant="danger-outline" disabled={busy === o.id} onClick={() => act(o.id, "cancel")}>Cancel and refund</Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
