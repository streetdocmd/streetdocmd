"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, FileText, Phone, Upload, AlertCircle, ShieldAlert, Stethoscope, User, Bike, Clock } from "lucide-react";
import { PHARMACY_FLOW, PHARMACY_STATUS } from "@/components/portal/statuses";
import { Card, CardHeader, Notice, PageHeader, Spinner, StatusBadge, formatDateTime, formatNaira, ui } from "@/components/portal/ui";

// What staff do next from each status (pending_payment → confirmed is the payment webhook's job)
const NEXT_ACTION: Record<string, { status: string; label: string }> = {
  sent:       { status: "pending_payment", label: "Send prices to patient" },
  confirmed:  { status: "dispensing",      label: "Start dispensing" },
  dispensing: { status: "dispatched",      label: "Dispatch with rider" },
  dispatched: { status: "delivered",       label: "Mark as delivered" },
};

export default function PharmacyOrderActions({ order, catalogue }: { order: any; catalogue: any[] }) {
  const router = useRouter();
  const currentIdx = PHARMACY_FLOW.indexOf(order.status);
  const next = NEXT_ACTION[order.status];

  const [advancing, setAdvancing]       = useState(false);
  const [prices, setPrices]             = useState<Record<number, number>>({});
  const [catalogueLinks, setCatalogueLinks] = useState<Record<number, string>>({});
  const [riderName, setRiderName]       = useState("");
  const [riderPhone, setRiderPhone]     = useState("");
  const [eta, setEta]                   = useState("");
  const [proofFile, setProofFile]       = useState<File | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState("");
  const [outOfStock, setOutOfStock]     = useState<number[]>([]);

  const drugs: any[] = order.drugs ?? [];
  const tracking = order.delivery_tracking?.[0];
  const status = PHARMACY_STATUS[order.status] ?? { label: order.status, tone: "gray" as const };
  const pricing = order.status === "sent";
  const draftTotal = drugs.reduce((s, _d, i) => s + (outOfStock.includes(i) ? 0 : prices[i] ?? 0), 0);
  const prescriber = order.requested_by === "patient"
    ? "Ordered directly by the patient"
    : `Dr ${order.providers?.name ?? "—"}${order.providers?.credentials ? ` (${order.providers.credentials})` : ""}`;

  function updatePrice(idx: number, val: string) {
    setPrices(p => ({ ...p, [idx]: parseFloat(val) || 0 }));
  }
  function toggleOOS(idx: number) {
    setOutOfStock(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  }
  function linkCatalogue(idx: number, catalogueId: string) {
    setCatalogueLinks(prev => ({ ...prev, [idx]: catalogueId }));
    // Prefill the price from the linked stock item; staff can still override it
    const item = catalogue.find(c => c.id === catalogueId);
    if (item) setPrices(p => ({ ...p, [idx]: Number(item.price) }));
  }

  async function advanceStatus() {
    if (!next) return;
    setError("");
    const body: Record<string, unknown> = { status: next.status };

    if (next.status === "pending_payment") {
      const inStock = drugs.map((_, i) => i).filter(i => !outOfStock.includes(i));
      if (inStock.length === 0) { setError("Every item is marked out of stock. Contact support to cancel or reassign this order."); return; }
      const unpriced = inStock.filter(i => !(prices[i] > 0)).map(i => drugs[i]?.drug_name ?? `Item ${i + 1}`);
      if (unpriced.length > 0) { setError(`Enter a price for ${unpriced.join(", ")}, or mark it out of stock.`); return; }
      body.drugPrices = prices;
      body.outOfStock = outOfStock;
      body.catalogueLinks = catalogueLinks;
    }
    if (next.status === "dispatched") {
      if (!riderName.trim() || !riderPhone.trim()) { setError("Enter the rider's name and phone number before dispatching."); return; }
      body.riderName = riderName.trim();
      body.riderPhone = riderPhone.trim();
      body.eta = eta ? new Date(eta).toISOString() : null;
    }

    setAdvancing(true);
    const res = await fetch(`/api/pharmacy-portal/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setAdvancing(false);
    if (res.ok) router.refresh();
    else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Couldn't update the order. Please try again."); }
  }

  async function uploadProof() {
    if (!proofFile) return;
    setError("");
    setSubmitting(true);
    const fd = new FormData();
    fd.append("proof", proofFile);
    const res = await fetch(`/api/pharmacy-portal/orders/${order.id}/delivery`, { method: "POST", body: fd });
    setSubmitting(false);
    if (res.ok) router.refresh();
    else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Upload failed. Please try again."); }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        back={{ href: "/pharmacy-portal/dashboard", label: "All orders" }}
        title={order.users?.name ?? "Patient"}
        description={`Received ${formatDateTime(order.created_at)}`}
        actions={<>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          {order.requires_review && <StatusBadge tone="amber" icon={ShieldAlert}>Controlled drug — review</StatusBadge>}
          {order.care_episode_id && (
            <a href={`/pharmacy-portal/journeys/${order.care_episode_id}`} className={`${ui.btnSecondary} min-h-9`}>Care team chat</a>
          )}
        </>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader title="Progress" />
            <div className="p-5">
              <ol className="flex flex-wrap gap-y-2 items-center">
                {PHARMACY_FLOW.map((s, i) => (
                  <li key={s} className="flex items-center">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
                      i < currentIdx ? "bg-green-50 text-green-700"
                      : i === currentIdx ? "bg-accent text-white"
                      : "bg-pending-bg text-muted"
                    }`}>
                      {i < currentIdx && <Check size={12} aria-hidden />}
                      {PHARMACY_STATUS[s].label}
                    </span>
                    {i < PHARMACY_FLOW.length - 1 && <ChevronRight size={14} className="text-line mx-0.5" aria-hidden />}
                  </li>
                ))}
              </ol>
              {order.status === "pending_payment" && (
                <div className="mt-4">
                  <Notice tone="blue" icon={Clock}>
                    Priced and waiting for the patient to pay. The order moves to &ldquo;Paid · ready&rdquo; automatically once payment clears.
                  </Notice>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Medications" description={pricing ? "Price each item you can supply, or mark it out of stock. Linking an item to your inventory deducts stock when you dispense." : undefined} />
            <ul className="divide-y divide-line">
              {drugs.map((d: any, i: number) => {
                const oos = outOfStock.includes(i) || d.out_of_stock;
                return (
                  <li key={i} className="px-5 py-4 space-y-2">
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="flex-1 min-w-[10rem]">
                        <p className={`text-sm font-medium ${oos ? "text-muted line-through" : "text-ink"}`}>
                          {d.drug_name}{d.strength ? ` ${d.strength}` : ""}
                        </p>
                        <p className="text-xs text-muted">
                          {[d.quantity ? `Qty ${d.quantity}` : null, d.frequency, d.duration].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      {pricing && (
                        <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer pt-1">
                          <input type="checkbox" className={ui.checkbox} checked={outOfStock.includes(i)} onChange={() => toggleOOS(i)} />
                          Out of stock
                        </label>
                      )}
                      {pricing && !outOfStock.includes(i) && (
                        <input type="number" min="0" step="any" placeholder="Price (₦)" aria-label={`Price for ${d.drug_name}`}
                          className={`${ui.input} w-32`} value={prices[i] ?? ""} onChange={e => updatePrice(i, e.target.value)} />
                      )}
                      {!pricing && (oos
                        ? <StatusBadge tone="red">Out of stock</StatusBadge>
                        : d.price != null && d.price > 0 && <span className="text-sm font-semibold text-ink">{formatNaira(d.price)}</span>)}
                    </div>
                    {pricing && !outOfStock.includes(i) && catalogue.length > 0 && (
                      <select className={`${ui.input} text-xs`} value={catalogueLinks[i] ?? d.catalogue_id ?? ""}
                        onChange={e => linkCatalogue(i, e.target.value)} aria-label={`Link ${d.drug_name} to inventory`}>
                        <option value="">Link to my inventory (optional)</option>
                        {catalogue.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.drug_name}{c.strength ? ` ${c.strength}` : ""} — {formatNaira(c.price)} · {c.stock_quantity} in stock
                          </option>
                        ))}
                      </select>
                    )}
                    {d.catalogue_id && !pricing && <p className="text-xs text-muted">Linked to inventory · stock deducted on dispense</p>}
                  </li>
                );
              })}
            </ul>
            <div className="flex justify-between px-5 py-3 border-t border-line text-sm font-semibold">
              <span>Total</span>
              <span>{formatNaira(pricing ? draftTotal : order.total_amount)}</span>
            </div>
          </Card>

          {next?.status === "dispatched" && (
            <Card>
              <CardHeader title="Rider details" description="The patient receives these by notification when you dispatch." />
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={ui.label} htmlFor="rider-name">Rider name *</label>
                  <input id="rider-name" className={ui.input} value={riderName} onChange={e => setRiderName(e.target.value)} />
                </div>
                <div>
                  <label className={ui.label} htmlFor="rider-phone">Rider phone *</label>
                  <input id="rider-phone" className={ui.input} type="tel" value={riderPhone} onChange={e => setRiderPhone(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={ui.label} htmlFor="eta">Estimated arrival</label>
                  <input id="eta" className={ui.input} type="datetime-local" value={eta} onChange={e => setEta(e.target.value)} />
                </div>
              </div>
            </Card>
          )}

          {order.status === "dispatched" && (
            <Card>
              <CardHeader title="Proof of delivery" description="Upload a photo or signed slip to mark the order delivered." />
              <div className="p-5 space-y-3">
                {tracking?.rider_name && (
                  <p className="flex items-center gap-2 text-sm text-ink">
                    <Bike size={16} className="text-muted" aria-hidden /> {tracking.rider_name} · {tracking.rider_phone}
                    {tracking.estimated_arrival && <span className="text-muted"> · ETA {formatDateTime(tracking.estimated_arrival)}</span>}
                  </p>
                )}
                <label className="flex items-center gap-3 rounded-lg border border-dashed border-line px-4 py-3 cursor-pointer hover:border-accent hover:bg-accent-soft/40 transition-colors">
                  <Upload size={18} className="text-muted" aria-hidden />
                  <span className="text-sm text-muted truncate">{proofFile ? proofFile.name : "Choose a photo or PDF"}</span>
                  <input type="file" className="sr-only" accept="image/*,application/pdf" onChange={e => setProofFile(e.target.files?.[0] ?? null)} />
                </label>
                {proofFile && (
                  <button onClick={uploadProof} disabled={submitting} className={ui.btnSuccess}>
                    {submitting ? <><Spinner /> Uploading…</> : "Upload & mark delivered"}
                  </button>
                )}
              </div>
            </Card>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3.5 py-2.5 rounded-lg">
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {error}
            </div>
          )}

          {next && (
            <button onClick={advanceStatus} disabled={advancing}
              className={`${next.status === "delivered" ? ui.btnSecondary : ui.btnPrimary} w-full py-3`}>
              {advancing ? <><Spinner /> Updating…</> : next.status === "delivered" ? "Mark as delivered without proof" : next.label}
            </button>
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
              <p className="flex items-start gap-2 text-muted"><Stethoscope size={15} className="text-muted mt-0.5 shrink-0" aria-hidden /> {prescriber}</p>
              {order.prescription_pdf_url && (
                <a href={order.prescription_pdf_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-accent hover:underline">
                  <FileText size={15} aria-hidden /> View prescription PDF
                </a>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Payment" />
            <div className="p-5 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted">Status</span>
                <StatusBadge tone={order.payment_status === "paid" || order.payment_status === "released" ? "green" : "amber"}>
                  {order.payment_status === "paid" ? "Paid" : order.payment_status === "released" ? "Released to pharmacy" : "Pending"}
                </StatusBadge>
              </div>
              {Number(order.total_amount) > 0 && (
                <div className="flex justify-between"><span className="text-muted">Order total</span><span className="font-semibold">{formatNaira(order.total_amount)}</span></div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
