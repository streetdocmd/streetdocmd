"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/shared";

interface CatalogueItem {
  id: string;
  test_name: string;
  test_code: string | null;
  price: number;
  turnaround_hours: number | null;
  sample_type: string | null;
}

interface SelectedTest {
  catalogue_id: string;
  test_name: string;
  test_code: string | null;
  price: number;
}

export default function LabInvestigationClient({
  labPartnerId, labName, catalogue,
}: {
  labPartnerId: string;
  labName: string;
  catalogue: CatalogueItem[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedTest[]>([]);
  const [pendingId, setPendingId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const available = catalogue.filter(item => !selected.some(s => s.catalogue_id === item.id));
  const total = selected.reduce((sum, t) => sum + t.price, 0);

  function addTest() {
    const item = catalogue.find(c => c.id === pendingId);
    if (!item) return;
    setSelected(prev => [...prev, {
      catalogue_id: item.id, test_name: item.test_name, test_code: item.test_code, price: item.price,
    }]);
    setPendingId("");
  }

  function removeTest(catalogueId: string) {
    setSelected(prev => prev.filter(t => t.catalogue_id !== catalogueId));
  }

  async function submit() {
    if (selected.length === 0) {
      setError("Please select at least one investigation.");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/lab-investigations/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labPartnerId,
          catalogueIds: selected.map(t => t.catalogue_id),
          clinicalNotes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not place order. Please try again.");
        setSubmitting(false);
        return;
      }
      router.push(`/dashboard/book/lab-investigations/tracking/${json.order_id}`);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Choose Specific Tests</h1>
        <p className="text-sm text-gray-500 mt-0.5">Lab: {labName}</p>
      </div>

      <div className="card p-5 space-y-3">
        <label className="label">Add an investigation</label>
        <div className="flex gap-2">
          <select className="input flex-1" value={pendingId} onChange={e => setPendingId(e.target.value)}>
            <option value="">Select a test…</option>
            {available.map(item => (
              <option key={item.id} value={item.id}>
                {item.test_name}{item.test_code ? ` (${item.test_code})` : ""} — {formatNaira(item.price)}
              </option>
            ))}
          </select>
          <button type="button" onClick={addTest} disabled={!pendingId} className="btn-primary px-4 text-sm shrink-0">
            Add
          </button>
        </div>
        {available.length === 0 && catalogue.length > 0 && (
          <p className="text-xs text-gray-400">All available tests have been added.</p>
        )}
      </div>

      {selected.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Selected Investigations</h3>
          <div className="space-y-2">
            {selected.map(t => (
              <div key={t.catalogue_id} className="flex items-center justify-between border-b border-gray-50 last:border-0 pb-2 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{t.test_name}</p>
                  {t.test_code && <p className="text-xs text-gray-400">{t.test_code}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-700">{formatNaira(t.price)}</span>
                  <button type="button" onClick={() => removeTest(t.catalogue_id)} className="text-xs text-red-500 hover:underline">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Total</span>
            <span className="text-sm font-bold text-blue-brand">{formatNaira(total)}</span>
          </div>
        </div>
      )}

      <div className="card p-5">
        <label className="label">Reason for investigation (optional)</label>
        <textarea
          className="input"
          rows={2}
          placeholder="e.g. Follow-up on symptoms, routine screening…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={submitting || selected.length === 0}
        className="btn-primary w-full text-base py-3"
      >
        {submitting ? "Placing order…" : `Request ${selected.length || ""} Investigation${selected.length === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
