"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Microscope, Plus, AlertCircle, AlertTriangle, Search, Truck } from "lucide-react";
import { Card, EmptyState, Notice, PageHeader, Spinner, formatNaira, ui } from "@/components/portal/ui";
import { Button, Chip, Pill, Toggle } from "@/components/ds";

export interface TestRow {
  id: string;
  test_name: string;
  test_code: string | null;
  price: number;
  turnaround_hours: number | null;
  sample_type: string | null;
  home_collection: boolean;
  active: boolean;
  preparation?: string | null;
  /** The StreetdocMD test this fulfils; orders are matched to labs through it (migration 067) */
  platform_test_id?: string | null;
  price_updated_at?: string | null;
}

const SAMPLES = ["Blood", "Urine", "Stool", "Swab", "Sputum", "Other"];
const TURNAROUND: { label: string; hours: number }[] = [
  { label: "Within 2 hours", hours: 2 },
  { label: "Same day", hours: 8 },
  { label: "Within 24 hours", hours: 24 },
  { label: "Within 48 hours", hours: 48 },
  { label: "Within 72 hours", hours: 72 },
  { label: "Within a week", hours: 168 },
];

function turnaroundLabel(h: number | null) {
  if (!h) return null;
  return TURNAROUND.find(t => t.hours === h)?.label ?? `Within ${h} hours`;
}

const shortDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : null;

interface FormState {
  id: string | null;
  test_name: string;
  test_code: string;
  price: string;
  turnaround_hours: string;
  sample_type: string;
  home_collection: boolean;
  active: boolean;
  preparation: string;
}

const BLANK: FormState = {
  id: null, test_name: "", test_code: "", price: "", turnaround_hours: "24", sample_type: "Blood",
  home_collection: true, active: true, preparation: "",
};

export interface PlatformTest { id: string; test_name: string; test_code: string | null }

export default function TestMenuClient({ tests, canEdit, loadError, platformTests = [], requested = [] }: {
  tests: TestRow[]; canEdit: boolean; loadError: string | null; platformTests?: PlatformTest[];
  /** Tests doctors have requested that no lab lists yet */
  requested?: string[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState("");

  const editingRow = form?.id ? tests.find(t => t.id === form.id) : undefined;
  const priceNum = Number(form?.price);
  const valid = !!form && form.test_name.trim().length > 0 && Number.isFinite(priceNum) && priceNum > 0;

  function openForm(t?: TestRow, name = "") {
    setError("");
    setForm(t ? {
      id: t.id, test_name: t.test_name, test_code: t.test_code ?? "", price: String(t.price),
      turnaround_hours: t.turnaround_hours ? String(t.turnaround_hours) : "", sample_type: t.sample_type ?? "",
      home_collection: t.home_collection, active: t.active, preparation: t.preparation ?? "",
    } : { ...BLANK, test_name: name });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !valid) return;
    setError("");
    setSaving(true);
    const body: Record<string, unknown> = {
      test_name: form.test_name, test_code: form.test_code, turnaround_hours: form.turnaround_hours,
      sample_type: form.sample_type, home_collection: form.home_collection, active: form.active, preparation: form.preparation,
    };
    // Only send the price when it changed, so its "updated" date stays honest
    if (!editingRow || Number(editingRow.price) !== priceNum) body.price = form.price;
    const res = await fetch(form.id ? `/api/lab-portal/catalogue/${form.id}` : "/api/lab-portal/catalogue", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "Couldn't save the test. Please try again.");
      return;
    }
    setForm(null);
    router.refresh();
  }

  async function toggle(t: TestRow) {
    setRowBusy(t.id);
    setRowError("");
    const res = await fetch(`/api/lab-portal/catalogue/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !t.active }),
    });
    setRowBusy(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setRowError(b.error ?? "Couldn't save that change. Please try again.");
      return;
    }
    router.refresh();
  }

  const on = tests.filter(t => t.active);
  const avg = on.length ? Math.round(on.reduce((a, t) => a + Number(t.price), 0) / on.length) : 0;
  const homeOn = on.filter(t => t.home_collection).length;
  const lastUpdate = tests.reduce<string | null>((l, t) => (t.price_updated_at && (!l || t.price_updated_at > l) ? t.price_updated_at : l), null);
  const visible = tests.filter(t => t.test_name.toLowerCase().includes(search.toLowerCase()) || (t.test_code ?? "").toLowerCase().includes(search.toLowerCase()));

  const kpis = [
    { label: "Tests on", value: String(on.length), hint: `of ${tests.length} listed` },
    { label: "Average price", value: formatNaira(avg), hint: "Across tests on" },
    { label: "Home collection", value: String(homeOn), hint: "Tests a collector can take" },
    { label: "Last price change", value: shortDate(lastUpdate) ?? "None", hint: "New orders use current prices" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your tests and prices"
        description="Write the price and turnaround for each test or investigation you run. Doctors and patients see the tests that are switched on."
        actions={canEdit && !form && <Button size="sm" onClick={() => openForm()}><Plus size={16} aria-hidden /> Add a test</Button>}
      />

      {loadError && <Notice tone="red" icon={AlertTriangle}>{loadError}</Notice>}
      {!canEdit && <Notice tone="blue">You&apos;re viewing as a StreetdocMD admin. Each lab manages its own price list from its staff account.</Notice>}
      {canEdit && on.length === 0 && !form && (
        <Notice tone="amber" icon={AlertTriangle}>
          Your lab has no tests switched on yet, so no one can order from you. Add the tests you offer to start receiving orders.
        </Notice>
      )}

      {canEdit && requested.length > 0 && !form && (
        <Card className="p-4">
          <b className="block text-ds-sm text-ink">Doctors have requested these tests</b>
          <small className="mb-2.5 block text-ds-xs text-muted">No lab lists them yet. Add a price for any you offer and patients can book them.</small>
          <div className="flex flex-wrap gap-2">
            {requested.map(name => (
              <Button key={name} size="sm" variant="secondary" onClick={() => openForm(undefined, name)}>
                <Plus size={14} aria-hidden /> {name}
              </Button>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(k => (
          <div key={k.label} className={`${ui.card} p-4`}>
            <small className="text-ds-xs font-semibold text-muted">{k.label}</small>
            <b className="mt-1 block text-ds-xl font-extrabold text-navy tabular-nums">{k.value}</b>
            <small className="text-ds-xs text-muted">{k.hint}</small>
          </div>
        ))}
      </div>

      {form && (
        <Card className="p-5">
          <form onSubmit={save} className="space-y-5">
            <p className="text-ds-md font-bold text-navy">{form.id ? "Edit test" : "Add a test"}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={ui.label} htmlFor="t-name">Test or investigation name</label>
                <input id="t-name" className={ui.input} list="t-names" placeholder="e.g. Full blood count" value={form.test_name}
                  onChange={e => setForm(f => f && { ...f, test_name: e.target.value })} />
                <datalist id="t-names">{platformTests.map(p => <option key={p.id} value={p.test_name} />)}</datalist>
                <p className={ui.hint}>Pick a suggestion when it&apos;s the same test, so orders for it reach you. Anything else is added as a new test.</p>
              </div>
              <div>
                <label className={ui.label} htmlFor="t-price">Your price (₦)</label>
                <input id="t-price" className={`${ui.input} font-bold tabular-nums`} type="number" min="1" step="any" placeholder="e.g. 6500"
                  value={form.price} onChange={e => setForm(f => f && { ...f, price: e.target.value })} />
                {editingRow?.price_updated_at && <p className={ui.hint}>Price last changed {shortDate(editingRow.price_updated_at)}</p>}
              </div>
              <div>
                <label className={ui.label} htmlFor="t-tat">How long results take</label>
                <select id="t-tat" className={ui.input} value={form.turnaround_hours}
                  onChange={e => setForm(f => f && { ...f, turnaround_hours: e.target.value })}>
                  <option value="">Not stated</option>
                  {TURNAROUND.map(t => <option key={t.hours} value={t.hours}>{t.label}</option>)}
                  {form.turnaround_hours && !TURNAROUND.some(t => String(t.hours) === form.turnaround_hours) && (
                    <option value={form.turnaround_hours}>Within {form.turnaround_hours} hours</option>
                  )}
                </select>
              </div>
            </div>

            <fieldset>
              <legend className={ui.label}>Sample type</legend>
              <div className="flex flex-wrap gap-2">
                {SAMPLES.map(s => (
                  <Chip key={s} selected={form.sample_type === s} onClick={() => setForm(f => f && { ...f, sample_type: s })}>{s}</Chip>
                ))}
              </div>
            </fieldset>

            <div className="rounded-ds-lg border border-line px-4 py-1">
              <div className="flex items-center justify-between gap-4 border-b border-line py-3">
                <span><b className="block text-ds-sm text-ink">Home collection</b><small className="text-ds-xs text-muted">A trained collector visits the patient</small></span>
                <Toggle label="Home collection" checked={form.home_collection} onChange={v => setForm(f => f && { ...f, home_collection: v })} />
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <span><b className="block text-ds-sm text-ink">Offered now</b><small className="text-ds-xs text-muted">This test can be ordered when on</small></span>
                <Toggle label="Offered now" checked={form.active} onChange={v => setForm(f => f && { ...f, active: v })} />
              </div>
            </div>

            <div>
              <label className={ui.label} htmlFor="t-prep">Preparation for the patient</label>
              <textarea id="t-prep" rows={3} maxLength={500} className={`${ui.input} py-3`}
                placeholder="e.g. Fast for 10 hours before the sample. Water is fine."
                value={form.preparation} onChange={e => setForm(f => f && { ...f, preparation: e.target.value })} />
              <p className={ui.hint}>Shown to the patient before the sample is taken.</p>
            </div>

            <div>
              <label className={ui.label} htmlFor="t-code">Test code</label>
              <input id="t-code" className={`${ui.input} sm:max-w-xs`} placeholder="Optional" value={form.test_code}
                onChange={e => setForm(f => f && { ...f, test_code: e.target.value })} />
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-ds-sm bg-danger-bg px-3.5 py-2.5 text-ds-sm font-semibold text-danger">
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {error}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving || !valid}>
                {saving ? <><Spinner /> Saving…</> : form.id ? "Save changes" : "Add to price list"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => { setForm(null); setError(""); }}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[17px] font-bold text-navy">All tests</h2>
          <div className="relative w-full max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input className={`${ui.input} pl-9`} placeholder="Search tests" aria-label="Search tests" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {rowError && <p role="alert" className="mb-2 text-ds-sm font-semibold text-danger">{rowError}</p>}

        <Card>
          {visible.length === 0 ? (
            <EmptyState icon={Microscope}
              title={tests.length === 0 ? "No tests on your price list yet" : "No matching tests"}
              description={tests.length === 0 ? "Add each test you offer with its price and turnaround time." : undefined}
              action={tests.length === 0 && canEdit && !form
                ? <Button size="sm" onClick={() => openForm()}><Plus size={16} aria-hidden /> Add your first test</Button>
                : undefined}
            />
          ) : (
            <ul className="px-4 sm:px-5">
              {visible.map(t => (
                <li key={t.id} className={`flex gap-4 border-b border-line py-4 last:border-0 ${t.active ? "" : "opacity-60"}`}>
                  <div className="min-w-0 flex-1">
                    <b className="block text-ds-control text-ink">{t.test_name}</b>
                    <small className="text-ds-xs text-muted">
                      {[t.sample_type, turnaroundLabel(t.turnaround_hours), t.test_code].filter(Boolean).join(" · ") || "No details yet"}
                    </small>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {t.home_collection ? <Pill tone="teal" icon={Truck}>Home collection</Pill> : <Pill tone="idle" icon={null}>Lab visit only</Pill>}
                      {!t.active && <Pill tone="idle">Not offered</Pill>}
                    </div>
                    {t.preparation && <small className="mt-1.5 block text-ds-xs text-ink/80">{t.preparation}</small>}
                  </div>
                  <div className="flex flex-none flex-col items-end gap-1.5 text-right">
                    {canEdit ? (
                      <button onClick={() => openForm(t)} className="text-ds-md font-extrabold text-navy tabular-nums hover:text-accent hover:underline">
                        {formatNaira(t.price)}
                      </button>
                    ) : <b className="text-ds-md font-extrabold text-navy tabular-nums">{formatNaira(t.price)}</b>}
                    {t.price_updated_at && <small className="text-ds-xs text-muted">Updated {shortDate(t.price_updated_at)}</small>}
                    {canEdit && (
                      <Toggle label={`Offer ${t.test_name}`} checked={t.active} disabled={rowBusy === t.id} onChange={() => toggle(t)} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <p className="mt-3 text-ds-xs text-muted">Price changes apply to new orders only. Orders already placed keep their price.</p>
      </section>
    </div>
  );
}
