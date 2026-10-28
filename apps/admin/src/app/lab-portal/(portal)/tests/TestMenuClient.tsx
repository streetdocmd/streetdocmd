"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Microscope, Plus, X, AlertCircle, AlertTriangle, Search } from "lucide-react";
import { Card, EmptyState, Notice, PageHeader, Spinner, StatusBadge, formatNaira, ui } from "@/components/portal/ui";

export interface TestRow {
  id: string;
  test_name: string;
  test_code: string | null;
  price: number;
  turnaround_hours: number | null;
  sample_type: string | null;
  home_collection: boolean;
  active: boolean;
}

const BLANK = { test_name: "", test_code: "", price: "", turnaround_hours: "24", sample_type: "", home_collection: true };

export default function TestMenuClient({ tests, canEdit, loadError }: { tests: TestRow[]; canEdit: boolean; loadError: string | null }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ price: "", turnaround_hours: "" });
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState("");

  async function addTest(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/lab-portal/catalogue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't add the test. Please try again.");
      return;
    }
    setForm(BLANK);
    setShowForm(false);
    router.refresh();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setRowBusy(id);
    setRowError("");
    const res = await fetch(`/api/lab-portal/catalogue/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setRowBusy(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setRowError(b.error ?? "Couldn't save that change. Please try again.");
      return false;
    }
    router.refresh();
    return true;
  }

  const activeCount = tests.filter(t => t.active).length;
  const visible = tests.filter(t => t.test_name.toLowerCase().includes(search.toLowerCase()) || (t.test_code ?? "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Test menu"
        description="The tests and prices StreetdocMD doctors can order from your lab. Only active tests are shown to doctors."
        actions={canEdit && (
          <button onClick={() => { setShowForm(s => !s); setError(""); }} className={showForm ? ui.btnSecondary : ui.btnPrimary}>
            {showForm ? <><X size={16} aria-hidden /> Cancel</> : <><Plus size={16} aria-hidden /> Add test</>}
          </button>
        )}
      />

      {loadError && <Notice tone="red" icon={AlertTriangle}>{loadError}</Notice>}
      {!canEdit && <Notice tone="blue">You&apos;re viewing as a StreetdocMD admin. Each lab manages its own test menu from its staff account.</Notice>}
      {canEdit && activeCount === 0 && !showForm && (
        <Notice tone="amber" icon={AlertTriangle}>
          Your lab has no active tests yet, so doctors can&apos;t order from you. Add the tests you offer to start receiving orders.
        </Notice>
      )}

      {showForm && (
        <Card className="p-5">
          <form onSubmit={addTest} className="space-y-4">
            <p className="font-semibold text-ink">New test</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={ui.label} htmlFor="t-name">Test name *</label>
                <input id="t-name" className={ui.input} required placeholder="e.g. Full Blood Count" value={form.test_name}
                  onChange={e => setForm(f => ({ ...f, test_name: e.target.value }))} />
              </div>
              <div>
                <label className={ui.label} htmlFor="t-price">Price (₦) *</label>
                <input id="t-price" className={ui.input} type="number" min="1" step="any" required value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div>
                <label className={ui.label} htmlFor="t-tat">Turnaround (hours)</label>
                <input id="t-tat" className={ui.input} type="number" min="1" step="1" value={form.turnaround_hours}
                  onChange={e => setForm(f => ({ ...f, turnaround_hours: e.target.value }))} />
              </div>
              <div>
                <label className={ui.label} htmlFor="t-sample">Sample type</label>
                <input id="t-sample" className={ui.input} placeholder="e.g. Blood, Urine" value={form.sample_type}
                  onChange={e => setForm(f => ({ ...f, sample_type: e.target.value }))} />
              </div>
              <div>
                <label className={ui.label} htmlFor="t-code">Test code</label>
                <input id="t-code" className={ui.input} placeholder="Optional" value={form.test_code}
                  onChange={e => setForm(f => ({ ...f, test_code: e.target.value }))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input type="checkbox" className={ui.checkbox} checked={form.home_collection}
                onChange={e => setForm(f => ({ ...f, home_collection: e.target.checked }))} />
              Sample can be collected at the patient&apos;s home
            </label>
            {error && (
              <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3.5 py-2.5 rounded-lg">
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {error}
              </div>
            )}
            <button type="submit" disabled={saving} className={ui.btnPrimary}>
              {saving ? <><Spinner /> Saving…</> : "Add to test menu"}
            </button>
          </form>
        </Card>
      )}

      <Card>
        <div className="px-5 py-3 border-b border-line flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[12rem] max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input className={`${ui.input} pl-9`} placeholder="Search tests…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <p className="text-xs text-muted">{activeCount} active · {tests.length} total</p>
        </div>
        {rowError && <p role="alert" className="px-5 pt-3 text-sm text-red-600">{rowError}</p>}

        {visible.length === 0 ? (
          <EmptyState icon={Microscope}
            title={tests.length === 0 ? "No tests on your menu yet" : "No matching tests"}
            description={tests.length === 0 ? "Add each test you offer with its price and turnaround time." : undefined}
            action={tests.length === 0 && canEdit && !showForm
              ? <button onClick={() => setShowForm(true)} className={ui.btnPrimary}><Plus size={16} aria-hidden /> Add your first test</button>
              : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-page/80 border-b border-line">
                <tr className="text-left text-xs font-semibold text-muted uppercase tracking-wide">
                  <th className="px-5 py-3">Test</th>
                  <th className="px-5 py-3">Price</th>
                  <th className="px-5 py-3">Turnaround</th>
                  <th className="px-5 py-3">Status</th>
                  {canEdit && <th className="px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map(t => (
                  <tr key={t.id} className="hover:bg-page/60">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink">{t.test_name}</p>
                      <p className="text-xs text-muted">
                        {[t.test_code, t.sample_type, t.home_collection ? "Home collection" : null].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {editingId === t.id ? (
                        <input className={`${ui.input} w-28`} type="number" min="1" step="any" aria-label="Price"
                          value={edit.price} onChange={e => setEdit(v => ({ ...v, price: e.target.value }))} />
                      ) : <span className="font-medium text-ink">{formatNaira(t.price)}</span>}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-muted">
                      {editingId === t.id ? (
                        <input className={`${ui.input} w-24`} type="number" min="1" step="1" aria-label="Turnaround hours"
                          value={edit.turnaround_hours} onChange={e => setEdit(v => ({ ...v, turnaround_hours: e.target.value }))} />
                      ) : t.turnaround_hours ? `${t.turnaround_hours} h` : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge tone={t.active ? "green" : "gray"}>{t.active ? "Active" : "Hidden"}</StatusBadge>
                    </td>
                    {canEdit && (
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {editingId === t.id ? (
                          <span className="inline-flex gap-3">
                            <button className={ui.btnLink} disabled={rowBusy === t.id}
                              onClick={async () => { if (await patch(t.id, edit)) setEditingId(null); }}>
                              {rowBusy === t.id ? "Saving…" : "Save"}
                            </button>
                            <button className="text-sm text-muted hover:text-ink" onClick={() => setEditingId(null)}>Cancel</button>
                          </span>
                        ) : (
                          <span className="inline-flex gap-3">
                            <button className={ui.btnLink} onClick={() => {
                              setEditingId(t.id);
                              setEdit({ price: String(t.price), turnaround_hours: t.turnaround_hours ? String(t.turnaround_hours) : "" });
                            }}>Edit</button>
                            <button className="text-sm text-muted hover:text-ink disabled:opacity-50" disabled={rowBusy === t.id}
                              onClick={() => patch(t.id, { active: !t.active })}>
                              {t.active ? "Hide" : "Show"}
                            </button>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
