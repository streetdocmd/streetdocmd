"use client";
import { useCallback, useEffect, useState } from "react";
import { Package, Plus, X, Upload, Search, AlertCircle, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Card, EmptyState, Notice, PageHeader, Spinner, StatusBadge, formatNaira, ui } from "@/components/portal/ui";
import InventoryImport from "./InventoryImport";

const FORMULATIONS = ["Tablet", "Capsule", "Syrup", "Injection", "Cream", "Ointment", "Drops", "Inhaler", "Other"];

const BLANK_FORM = {
  drug_name: "", generic_name: "", formulation: "Tablet", strength: "",
  // Defaults to true: anything not flagged prescription-only can be bought by
  // patients directly (Buy Medication), so staff opt items OUT of the
  // restriction deliberately rather than forgetting to opt them in.
  price: "", stock_quantity: "", prescription_required: true,
};

interface LibraryItem {
  id: string; name: string; generic_name: string | null;
  formulation: string | null; strength: string | null;
}

/** partnerId is resolved server-side; null means a StreetdocMD admin viewing every pharmacy. */
export default function InventoryClient({ partnerId }: { partnerId: string | null }) {
  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState("");
  const [drugs, setDrugs]             = useState<any[]>([]);
  const [search, setSearch]           = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm]       = useState(false);
  const [showImport, setShowImport]   = useState(false);
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState("");
  const [form, setForm]               = useState(BLANK_FORM);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editValues, setEditValues]   = useState<{ price: string; stock_quantity: string }>({ price: "", stock_quantity: "" });
  const [savingRow, setSavingRow]     = useState<string | null>(null);
  const [rowError, setRowError]       = useState("");
  const [library, setLibrary]         = useState<LibraryItem[]>([]);
  const [librarySearch, setLibrarySearch] = useState("");

  const loadDrugs = useCallback(async () => {
    const supabase = createClient();
    let q = supabase.from("drug_catalogue").select("*").order("drug_name");
    if (partnerId) q = q.eq("pharmacy_partner_id", partnerId);
    const { data, error } = await q;
    if (error) setLoadError("We couldn't load your inventory. Refresh the page, or contact support if this keeps happening.");
    else { setLoadError(""); setDrugs(data ?? []); }
    setLoading(false);
  }, [partnerId]);

  useEffect(() => {
    loadDrugs();
    createClient()
      .from("medication_library")
      .select("id, name, generic_name, formulation, strength")
      .order("name")
      .then(({ data }) => setLibrary(data ?? []));
  }, [loadDrugs]);

  function pickFromLibrary(item: LibraryItem) {
    setForm(f => ({
      ...f,
      drug_name: item.name,
      generic_name: item.generic_name ?? "",
      formulation: item.formulation ?? f.formulation,
      strength: item.strength ?? "",
    }));
    setLibrarySearch("");
  }

  const libraryMatches = librarySearch.trim()
    ? library.filter(item =>
        item.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
        (item.generic_name ?? "").toLowerCase().includes(librarySearch.toLowerCase())
      ).slice(0, 8)
    : [];

  async function addDrug(e: React.FormEvent) {
    e.preventDefault();
    if (!partnerId) return;
    setFormError("");
    const price = parseFloat(form.price);
    const stock = parseInt(form.stock_quantity, 10);
    if (!form.drug_name.trim()) { setFormError("Enter the drug name."); return; }
    if (!Number.isFinite(price) || price < 0) { setFormError("Enter a valid price."); return; }
    if (!Number.isInteger(stock) || stock < 0) { setFormError("Stock must be a whole number of 0 or more."); return; }
    setSaving(true);
    const { error } = await createClient().from("drug_catalogue").insert({
      pharmacy_partner_id: partnerId,
      drug_name: form.drug_name.trim(),
      generic_name: form.generic_name.trim() || null,
      formulation: form.formulation,
      strength: form.strength.trim() || null,
      price,
      stock_quantity: stock,
      in_stock: stock > 0,
      prescription_required: form.prescription_required,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { setFormError(`Couldn't add the drug: ${error.message}`); return; }
    setForm(BLANK_FORM);
    setShowForm(false);
    await loadDrugs();
  }

  function startEdit(d: any) {
    setRowError("");
    setEditingId(d.id);
    setEditValues({ price: String(d.price), stock_quantity: String(d.stock_quantity) });
  }

  async function saveEdit(id: string) {
    const stock = parseInt(editValues.stock_quantity, 10);
    const price = parseFloat(editValues.price);
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
      setRowError("Enter a valid price and a whole-number stock quantity.");
      return;
    }
    setSavingRow(id);
    setRowError("");
    const { error } = await createClient().from("drug_catalogue").update({
      price, stock_quantity: stock, in_stock: stock > 0, updated_at: new Date().toISOString(),
    }).eq("id", id);
    setSavingRow(null);
    if (error) { setRowError(`Couldn't save: ${error.message}`); return; }
    setDrugs(prev => prev.map(d => d.id === id ? { ...d, price, stock_quantity: stock, in_stock: stock > 0, updated_at: new Date().toISOString() } : d));
    setEditingId(null);
  }

  async function toggleActive(id: string, current: boolean) {
    setSavingRow(id);
    setRowError("");
    const { error } = await createClient().from("drug_catalogue").update({
      active: !current, updated_at: new Date().toISOString(),
    }).eq("id", id);
    setSavingRow(null);
    if (error) { setRowError(`Couldn't update: ${error.message}`); return; }
    setDrugs(prev => prev.map(d => d.id === id ? { ...d, active: !current } : d));
  }

  const visibleDrugs = drugs
    .filter(d => showInactive || d.active)
    .filter(d => d.drug_name.toLowerCase().includes(search.toLowerCase()) || (d.generic_name ?? "").toLowerCase().includes(search.toLowerCase()));

  const activeDrugs = drugs.filter(d => d.active);
  const lastUpdated = activeDrugs.length > 0
    ? activeDrugs.reduce((latest, d) => new Date(d.updated_at) > new Date(latest) ? d.updated_at : latest, activeDrugs[0].updated_at)
    : null;
  const daysSinceUpdate = lastUpdated ? Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 86_400_000) : null;
  const outOfStock = activeDrugs.filter(d => d.stock_quantity <= 0).length;

  if (loading) {
    return <div className="flex justify-center py-20 text-accent"><Spinner className="w-7 h-7" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="The prices and stock here are what patients see when a prescription is sent to you. Keep them current so orders don't need a back-and-forth."
        actions={partnerId && <>
          <button onClick={() => { setShowImport(s => !s); setShowForm(false); }} className={ui.btnSecondary}>
            {showImport ? <><X size={16} aria-hidden /> Close import</> : <><Upload size={16} aria-hidden /> Import CSV</>}
          </button>
          <button onClick={() => { setShowForm(s => !s); setShowImport(false); setFormError(""); }} className={showForm ? ui.btnSecondary : ui.btnPrimary}>
            {showForm ? <><X size={16} aria-hidden /> Cancel</> : <><Plus size={16} aria-hidden /> Add drug</>}
          </button>
        </>}
      />

      {loadError && <Notice tone="red" icon={AlertTriangle}>{loadError}</Notice>}
      {!partnerId && <Notice tone="blue">You&apos;re viewing every pharmacy&apos;s inventory as a StreetdocMD admin. Adding drugs is done from a pharmacy staff account.</Notice>}

      {partnerId && (activeDrugs.length === 0 ? (
        <Notice tone="amber" icon={AlertTriangle}>
          You haven&apos;t added any inventory yet, so patients can&apos;t order medication from you. Import your existing stock list from a spreadsheet, or add drugs one at a time.
        </Notice>
      ) : daysSinceUpdate !== null && daysSinceUpdate > 14 ? (
        <Notice tone="amber" icon={AlertTriangle}>
          Your prices were last updated {daysSinceUpdate} days ago. Worth a check to make sure they&apos;re still accurate.
        </Notice>
      ) : null)}

      {showImport && partnerId && (
        <InventoryImport partnerId={partnerId} existing={drugs} onDone={loadDrugs} />
      )}

      {showForm && partnerId && (
        <Card className="p-5">
          <form onSubmit={addDrug} className="space-y-4">
            <p className="font-semibold text-ink">New drug</p>
            <div className="relative">
              <label className={ui.label} htmlFor="lib-search">Search the medication library (optional, fills the fields below)</label>
              <input id="lib-search" className={ui.input} placeholder="Start typing a drug name…" autoComplete="off"
                value={librarySearch} onChange={e => setLibrarySearch(e.target.value)} />
              {libraryMatches.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-line rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {libraryMatches.map(item => (
                    <button type="button" key={item.id} onClick={() => pickFromLibrary(item)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-page border-b border-line last:border-0">
                      <span className="font-medium text-ink">{item.name}</span>
                      {item.strength && <span className="text-muted"> · {item.strength}</span>}
                      {item.generic_name && <span className="text-muted text-xs block">{item.generic_name}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={ui.label}>Drug name *</label><input className={ui.input} required value={form.drug_name} onChange={e => setForm(f => ({ ...f, drug_name: e.target.value }))} /></div>
              <div><label className={ui.label}>Generic name</label><input className={ui.input} value={form.generic_name} onChange={e => setForm(f => ({ ...f, generic_name: e.target.value }))} /></div>
              <div>
                <label className={ui.label}>Formulation</label>
                <select className={ui.input} value={form.formulation} onChange={e => setForm(f => ({ ...f, formulation: e.target.value }))}>
                  {FORMULATIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div><label className={ui.label}>Strength</label><input className={ui.input} placeholder="e.g. 500mg" value={form.strength} onChange={e => setForm(f => ({ ...f, strength: e.target.value }))} /></div>
              <div><label className={ui.label}>Price (₦) *</label><input className={ui.input} type="number" min="0" step="any" required value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
              <div><label className={ui.label}>Stock quantity *</label><input className={ui.input} type="number" min="0" step="1" required value={form.stock_quantity} onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input type="checkbox" className={ui.checkbox} checked={form.prescription_required} onChange={e => setForm(f => ({ ...f, prescription_required: e.target.checked }))} />
              Requires a prescription to dispense
            </label>
            {formError && (
              <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3.5 py-2.5 rounded-lg">
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {formError}
              </div>
            )}
            <button type="submit" disabled={saving} className={ui.btnPrimary}>
              {saving ? <><Spinner /> Saving…</> : "Add to inventory"}
            </button>
          </form>
        </Card>
      )}

      <Card>
        <div className="px-5 py-3 border-b border-line flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[12rem] max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input className={`${ui.input} pl-9`} placeholder="Search inventory…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
            <input type="checkbox" className={ui.checkbox} checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            Show inactive
          </label>
          <p className="text-xs text-muted ml-auto">
            {activeDrugs.length} active{outOfStock > 0 ? ` · ${outOfStock} out of stock` : ""}
          </p>
        </div>
        {rowError && <p role="alert" className="px-5 pt-3 text-sm text-red-600">{rowError}</p>}

        {visibleDrugs.length === 0 ? (
          <EmptyState icon={Package}
            title={drugs.length === 0 ? "No drugs in your inventory yet" : "No matching drugs"}
            description={drugs.length === 0 ? "Import a CSV of your stock list or add drugs one at a time." : undefined}
            action={drugs.length === 0 && partnerId && !showImport && !showForm
              ? <button onClick={() => setShowImport(true)} className={ui.btnPrimary}><Upload size={16} aria-hidden /> Import from spreadsheet</button>
              : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-page/80 border-b border-line">
                <tr className="text-left text-xs font-semibold text-muted uppercase tracking-wide">
                  <th className="px-5 py-3">Drug</th>
                  <th className="px-5 py-3">Formulation</th>
                  <th className="px-5 py-3">Price</th>
                  <th className="px-5 py-3">Stock</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visibleDrugs.map(d => (
                  <tr key={d.id} className="hover:bg-page/60">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink">{d.drug_name}{d.strength ? ` ${d.strength}` : ""}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {d.generic_name && <span className="text-xs text-muted">{d.generic_name}</span>}
                        {d.prescription_required && <StatusBadge tone="purple">Rx</StatusBadge>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted">{d.formulation ?? "—"}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {editingId === d.id ? (
                        <input className={`${ui.input} w-28`} type="number" min="0" step="any" aria-label="Price" value={editValues.price}
                          onChange={e => setEditValues(v => ({ ...v, price: e.target.value }))} />
                      ) : <span className="font-medium text-ink">{formatNaira(d.price)}</span>}
                    </td>
                    <td className="px-5 py-3">
                      {editingId === d.id ? (
                        <input className={`${ui.input} w-24`} type="number" min="0" step="1" aria-label="Stock quantity" value={editValues.stock_quantity}
                          onChange={e => setEditValues(v => ({ ...v, stock_quantity: e.target.value }))} />
                      ) : <span className={d.stock_quantity > 0 ? "text-ink" : "text-red-600 font-medium"}>{d.stock_quantity}</span>}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge tone={!d.active ? "gray" : d.stock_quantity > 0 ? "green" : "red"}>
                        {!d.active ? "Inactive" : d.stock_quantity > 0 ? "In stock" : "Out of stock"}
                      </StatusBadge>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {editingId === d.id ? (
                        <span className="inline-flex gap-3">
                          <button onClick={() => saveEdit(d.id)} disabled={savingRow === d.id} className={ui.btnLink}>
                            {savingRow === d.id ? "Saving…" : "Save"}
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-sm text-muted hover:text-ink">Cancel</button>
                        </span>
                      ) : (
                        <span className="inline-flex gap-3">
                          <button onClick={() => startEdit(d)} className={ui.btnLink}>Edit</button>
                          <button onClick={() => toggleActive(d.id, d.active)} disabled={savingRow === d.id}
                            className="text-sm text-muted hover:text-ink disabled:opacity-50">
                            {d.active ? "Deactivate" : "Activate"}
                          </button>
                        </span>
                      )}
                    </td>
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
