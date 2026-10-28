"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/shared";
import { Check, Search } from "lucide-react";
import { Button, Card, Notice, TopBar, cx, fieldLabelClass, focusRing, inputClass } from "@/components/ds";

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

function turnaround(hours: number | null) {
  if (!hours) return "";
  return hours < 48 ? `Results in ${hours} hours` : `Results in ${Math.round(hours / 24)} days`;
}

export default function LabInvestigationClient({
  catalogue,
}: {
  catalogue: CatalogueItem[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedTest[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const total = selected.reduce((sum, t) => sum + t.price, 0);
  const isSelected = (id: string) => selected.some(s => s.catalogue_id === id);
  const shown = catalogue.filter(item =>
    !query.trim() || `${item.test_name} ${item.test_code ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function addTest(item: CatalogueItem) {
    setSelected(prev => [...prev, {
      catalogue_id: item.id, test_name: item.test_name, test_code: item.test_code, price: item.price,
    }]);
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
    <div className="mx-auto max-w-2xl">
      <TopBar title="Specific tests" backHref="/dashboard/book/lab-investigations" className="-mx-5 -mt-2 md:mx-0" />
      <p className="mb-4 text-ds-xs text-muted">Search and select exactly the tests you need.</p>

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[17px] font-bold text-navy">Tests on offer</h2>
        <span className="text-ds-sm text-muted">Prices in Naira</span>
      </div>
      <label className="mb-1.5 flex h-[54px] items-center gap-2.5 rounded-[18px] border-[1.5px] border-line bg-surface px-4 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-soft">
        <Search size={20} className="flex-none text-navy" aria-hidden />
        <input
          className="min-w-0 flex-1 bg-transparent text-ds-control text-ink outline-none placeholder:text-muted"
          placeholder="Search a test"
          aria-label="Search a test"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </label>

      <Card padded={false} className="px-4 py-1">
        {shown.map(item => {
          const on = isSelected(item.id);
          const details = [turnaround(item.turnaround_hours), item.sample_type && `${item.sample_type} sample`].filter(Boolean).join(" · ");
          return (
            <div key={item.id} className="flex items-center gap-3 border-b border-line py-3.5 last:border-b-0">
              <div className="min-w-0 flex-1">
                <b className="block text-ds-sm text-ink">{item.test_name}</b>
                {details && <small className="block text-ds-xs text-muted">{details}</small>}
              </div>
              <div className="text-right">
                <div className="text-ds-sm font-extrabold text-navy tabular-nums">{formatNaira(item.price)}</div>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => (on ? removeTest(item.id) : addTest(item))}
                  className={cx(
                    "mt-1.5 inline-flex min-h-9 items-center gap-1 rounded-xl border-[1.5px] px-3 text-[13px] font-bold",
                    on ? "border-accent bg-accent text-white" : "border-accent bg-surface text-accent",
                    focusRing,
                  )}
                >
                  {on ? <><Check size={14} aria-hidden /> Added</> : "Add"}
                </button>
              </div>
            </div>
          );
        })}
        {shown.length === 0 && (
          <p className="py-[18px] text-center text-ds-sm text-muted">
            {catalogue.length === 0 ? "No tests are listed yet." : "No test by that name here."}
          </p>
        )}
      </Card>

      <div className="mt-5">
        <label htmlFor="lab-notes" className={fieldLabelClass}>Reason for the tests <span className="font-normal text-muted">(optional)</span></label>
        <textarea
          id="lab-notes"
          className={inputClass(false, "min-h-24 py-3 leading-normal")}
          rows={2}
          placeholder="e.g. Follow up on symptoms, routine screening"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      {error && <Notice tone="danger" className="mt-4">{error}</Notice>}

      <div className="sticky bottom-[76px] z-20 mt-6 flex items-center gap-3.5 rounded-ds-lg border border-line bg-surface/95 p-3.5 shadow-ds backdrop-blur md:bottom-4">
        <div>
          <small className="block text-ds-2xs font-bold text-muted">
            {selected.length} test{selected.length === 1 ? "" : "s"}
          </small>
          <b className="text-[20px] tracking-[-0.01em] text-navy tabular-nums">{formatNaira(total)}</b>
        </div>
        <Button className="flex-1" onClick={submit} disabled={submitting || selected.length === 0}>
          {submitting ? "Placing order…" : `Request ${selected.length || ""} test${selected.length === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}
