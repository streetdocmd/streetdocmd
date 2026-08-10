"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_FLOW = [
  { value: "sent",            label: "Received" },
  { value: "pending_payment", label: "Awaiting Payment" },
  { value: "confirmed",       label: "Confirmed" },
  { value: "dispensing",      label: "Dispensing" },
  { value: "dispatched",      label: "Dispatched" },
  { value: "delivered",       label: "Delivered" },
];

const STATUS_COLOR: Record<string, string> = {
  pending_payment: "bg-yellow-100 text-yellow-700",
  sent:            "bg-blue-100 text-blue-700",
  confirmed:       "bg-purple-100 text-purple-700",
  dispensing:      "bg-orange-100 text-orange-700",
  dispatched:      "bg-teal-100 text-teal-700",
  delivered:       "bg-green-100 text-green-700",
};

export default function PharmacyOrderActions({ order }: { order: any }) {
  const router = useRouter();
  const currentIdx = STATUS_FLOW.findIndex(s => s.value === order.status);
  const nextStep   = STATUS_FLOW[currentIdx + 1];

  const [advancing, setAdvancing]       = useState(false);
  const [prices, setPrices]             = useState<Record<number, number>>({});
  const [riderName, setRiderName]       = useState("");
  const [riderPhone, setRiderPhone]     = useState("");
  const [eta, setEta]                   = useState("");
  const [proofFile, setProofFile]       = useState<File | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState("");
  const [outOfStock, setOutOfStock]     = useState<number[]>([]);

  const drugs: any[] = order.drugs ?? [];
  const tracking = order.delivery_tracking?.[0];

  function updatePrice(idx: number, val: string) {
    setPrices(p => ({ ...p, [idx]: parseFloat(val) || 0 }));
  }
  function toggleOOS(idx: number) {
    setOutOfStock(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  }

  async function advanceStatus() {
    if (!nextStep) return;
    setAdvancing(true);
    setError("");

    const body: Record<string, unknown> = { status: nextStep.value };

    // On "dispatched" — require rider details
    if (nextStep.value === "dispatched") {
      if (!riderName || !riderPhone) {
        setError("Enter rider name and phone before dispatching.");
        setAdvancing(false);
        return;
      }
      body.riderName  = riderName;
      body.riderPhone = riderPhone;
      body.eta        = eta || null;
    }

    // On "pending_payment" — set prices (hands the order off to the patient to pay)
    if (nextStep.value === "pending_payment") {
      body.drugPrices   = prices;
      body.outOfStock   = outOfStock;
    }

    const res = await fetch(`/api/pharmacy-portal/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setAdvancing(false);
    if (res.ok) router.refresh();
    else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed"); }
  }

  async function uploadProof() {
    if (!proofFile) return;
    setSubmitting(true);
    const fd = new FormData();
    fd.append("proof", proofFile);
    const res = await fetch(`/api/pharmacy-portal/orders/${order.id}/delivery`, { method: "POST", body: fd });
    setSubmitting(false);
    if (res.ok) router.refresh();
    else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Upload failed"); }
  }

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="text-sm text-blue-600 hover:underline">← Back</button>

      {/* Header */}
      <div className="card p-5 space-y-3">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="font-bold text-gray-900 text-lg">{order.users?.name ?? "Patient"}</p>
            <p className="text-sm text-gray-500">{order.users?.phone}</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLOR[order.status] ?? "bg-gray-100 text-gray-600"}`}>
              {STATUS_FLOW.find(s => s.value === order.status)?.label ?? order.status}
            </span>
            {order.requires_review && (
              <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">⚠ Controlled Drug — Review</span>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600">
          <span className="font-medium">Prescribed by:</span> Dr {order.providers?.name}{order.providers?.credentials ? ` (${order.providers.credentials})` : ""}
        </p>
        <p className="text-sm text-gray-600">
          <span className="font-medium">Payment:</span>{" "}
          <span className={order.payment_status === "paid" ? "text-green-600 font-semibold" : "text-yellow-600"}>
            {order.payment_status === "paid" ? "Paid" : order.payment_status === "released" ? "Released to pharmacy" : "Pending"}
          </span>
          {order.total_amount > 0 && ` · ₦${Number(order.total_amount).toLocaleString()}`}
        </p>

        {/* Prescription PDF */}
        {order.prescription_pdf_url && (
          <a href={order.prescription_pdf_url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
            📄 View Digital Prescription PDF
          </a>
        )}
      </div>

      {/* Status progress */}
      <div className="card p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Progress</p>
        <div className="flex gap-1 flex-wrap">
          {STATUS_FLOW.map((step, i) => (
            <div key={step.value} className="flex items-center gap-1">
              <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                i < currentIdx ? "bg-green-100 text-green-700" :
                i === currentIdx ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"
              }`}>
                {i < currentIdx && "✓ "}{step.label}
              </span>
              {i < STATUS_FLOW.length - 1 && <span className="text-gray-300 text-xs">→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Drug list + price confirmation */}
      <div className="card p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Medications</p>
        <div className="divide-y divide-gray-100">
          {drugs.map((d: any, i: number) => (
            <div key={i} className="py-3 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{d.drug_name}{d.strength ? ` ${d.strength}` : ""}</p>
                {d.frequency && <p className="text-xs text-gray-500">{d.frequency}{d.duration ? ` · ${d.duration}` : ""}</p>}
              </div>
              {order.status === "sent" && (
                <label className="flex items-center gap-1 text-xs text-red-500 cursor-pointer">
                  <input type="checkbox" checked={outOfStock.includes(i)} onChange={() => toggleOOS(i)} />
                  Out of stock
                </label>
              )}
              {order.status === "sent" && !outOfStock.includes(i) && (
                <input
                  type="number" min="0" placeholder="Price (₦)"
                  className="w-28 input text-sm"
                  value={prices[i] ?? ""}
                  onChange={e => updatePrice(i, e.target.value)}
                />
              )}
              {order.status !== "sent" && d.price != null && d.price > 0 && (
                <span className="text-sm font-medium text-gray-700">₦{Number(d.price).toLocaleString()}</span>
              )}
              {outOfStock.includes(i) && (
                <span className="text-xs text-red-500 font-semibold">Out of stock</span>
              )}
            </div>
          ))}
        </div>
        {order.total_amount > 0 && (
          <div className="flex justify-between pt-3 border-t border-gray-100 mt-1">
            <span className="text-sm font-bold">Total</span>
            <span className="text-sm font-bold">₦{Number(order.total_amount).toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Rider details form — shown when about to dispatch */}
      {nextStep?.value === "dispatched" && (
        <div className="card p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Rider Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Rider name *</label><input className="input" value={riderName} onChange={e => setRiderName(e.target.value)} /></div>
            <div><label className="label">Rider phone *</label><input className="input" value={riderPhone} onChange={e => setRiderPhone(e.target.value)} /></div>
            <div className="col-span-2"><label className="label">Estimated arrival time</label>
              <input className="input" type="datetime-local" value={eta} onChange={e => setEta(e.target.value)} /></div>
          </div>
        </div>
      )}

      {/* Existing tracking info */}
      {tracking && order.status === "dispatched" && (
        <div className="card p-5 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Delivery Tracking</p>
          {tracking.rider_name && <p className="text-sm font-medium text-gray-900">🛵 {tracking.rider_name} · {tracking.rider_phone}</p>}
          {tracking.estimated_arrival && <p className="text-sm text-gray-500">ETA: {new Date(tracking.estimated_arrival).toLocaleString("en-NG")}</p>}
        </div>
      )}

      {/* Proof of delivery upload */}
      {order.status === "dispatched" && (
        <div className="card p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Proof of Delivery</p>
          <input type="file" accept="image/*,application/pdf" onChange={e => setProofFile(e.target.files?.[0] ?? null)} className="text-sm text-gray-600" />
          {proofFile && (
            <button onClick={uploadProof} disabled={submitting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
              {submitting ? "Uploading…" : "Upload & Mark Delivered"}
            </button>
          )}
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Awaiting payment — nothing for pharmacy to do until the webhook confirms it */}
      {order.status === "pending_payment" && (
        <p className="text-center text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-xl py-3">
          Priced — waiting for the patient to complete payment. This order moves to
          "Confirmed" automatically once payment clears.
        </p>
      )}

      {/* Advance status button */}
      {nextStep && !["delivered", "cancelled", "expired", "pending_payment"].includes(order.status) && (
        <button onClick={advanceStatus} disabled={advancing}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
          {advancing ? "Updating…" : `Mark as: ${nextStep.label}`}
        </button>
      )}
    </div>
  );
}
