"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

const FORMULATIONS = ["Tablet", "Capsule", "Syrup", "Injection", "Cream", "Ointment", "Drops", "Inhaler", "Other"];

const BLANK_FORM = {
  drug_name: "", generic_name: "", formulation: "Tablet", strength: "",
  price: "", stock_quantity: "", prescription_required: false,
};

export default function InventoryPage() {
  const [loading, setLoading]         = useState(true);
  const [partnerId, setPartnerId]     = useState<string | null>(null);
  const [drugs, setDrugs]             = useState<any[]>([]);
  const [search, setSearch]           = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [form, setForm]               = useState(BLANK_FORM);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editValues, setEditValues]   = useState<{ price: string; stock_quantity: string }>({ price: "", stock_quantity: "" });
  const [savingRow, setSavingRow]     = useState<string | null>(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    let pid: string | null = null;
    if (profile?.role === "pharmacy_staff") {
      const { data: staff } = await supabase.from("pharmacy_staff").select("pharmacy_partner_id").eq("user_id", user.id).single();
      pid = staff?.pharmacy_partner_id ?? null;
    }
    setPartnerId(pid);
    await loadDrugs(pid);
  }

  async function loadDrugs(pid: string | null) {
    const supabase = createClient();
    let q = supabase.from("drug_catalogue").select("*").order("drug_name");
    if (pid) q = q.eq("pharmacy_partner_id", pid);
    const { data } = await q;
    setDrugs(data ?? []);
    setLoading(false);
  }

  async function addDrug(e: React.FormEvent) {
    e.preventDefault();
    if (!partnerId) return;
    setSaving(true);
    const supabase = createClient();
    const stock = parseInt(form.stock_quantity) || 0;
    const { error } = await supabase.from("drug_catalogue").insert({
      pharmacy_partner_id: partnerId,
      drug_name: form.drug_name.trim(),
      generic_name: form.generic_name.trim() || null,
      formulation: form.formulation,
      strength: form.strength.trim() || null,
      price: parseFloat(form.price) || 0,
      stock_quantity: stock,
      in_stock: stock > 0,
      prescription_required: form.prescription_required,
      updated_at: new Date().toISOString(),
    });
    if (!error) {
      setForm(BLANK_FORM);
      setShowForm(false);
      await loadDrugs(partnerId);
    }
    setSaving(false);
  }

  function startEdit(d: any) {
    setEditingId(d.id);
    setEditValues({ price: String(d.price), stock_quantity: String(d.stock_quantity) });
  }

  async function saveEdit(id: string) {
    setSavingRow(id);
    const supabase = createClient();
    const stock = parseInt(editValues.stock_quantity) || 0;
    const price = parseFloat(editValues.price) || 0;
    const { error } = await supabase.from("drug_catalogue").update({
      price, stock_quantity: stock, in_stock: stock > 0, updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (!error) {
      setDrugs(prev => prev.map(d => d.id === id ? { ...d, price, stock_quantity: stock, in_stock: stock > 0 } : d));
      setEditingId(null);
    }
    setSavingRow(null);
  }

  async function toggleActive(id: string, current: boolean) {
    setSavingRow(id);
    const supabase = createClient();
    const { error } = await supabase.from("drug_catalogue").update({
      active: !current, updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (!error) setDrugs(prev => prev.map(d => d.id === id ? { ...d, active: !current } : d));
    setSavingRow(null);
  }

  const visibleDrugs = drugs
    .filter(d => showInactive || d.active)
    .filter(d => d.drug_name.toLowerCase().includes(search.toLowerCase()) || (d.generic_name ?? "").toLowerCase().includes(search.toLowerCase()));

  const activeDrugs = drugs.filter(d => d.active);
  const lastUpdated = activeDrugs.length > 0
    ? activeDrugs.reduce((latest, d) => new Date(d.updated_at) > new Date(latest) ? d.updated_at : latest, activeDrugs[0].updated_at)
    : null;
  const daysSinceUpdate = lastUpdated ? Math.floor((Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24)) : null;

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Prices and stock here are what patients see when a prescription is sent to you — keep them current so orders don't need a back-and-forth.
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:opacity-90 shrink-0">
          {showForm ? "Cancel" : "+ Add Drug"}
        </button>
      </div>

      {activeDrugs.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 text-sm text-amber-800">
          You haven't added any inventory yet — patients can't order medication from you until you do.
        </div>
      ) : daysSinceUpdate !== null && daysSinceUpdate > 14 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 text-sm text-amber-800">
          Your prices were last updated {daysSinceUpdate} days ago — worth a check to make sure they're still accurate?
        </div>
      ) : null}

      {showForm && (
        <form onSubmit={addDrug} className="card p-5 space-y-4">
          <p className="font-semibold text-gray-900">New Drug</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Drug name *</label><input className="input" required value={form.drug_name} onChange={e => setForm(f => ({ ...f, drug_name: e.target.value }))} /></div>
            <div><label className="label">Generic name</label><input className="input" value={form.generic_name} onChange={e => setForm(f => ({ ...f, generic_name: e.target.value }))} /></div>
            <div>
              <label className="label">Formulation</label>
              <select className="input" value={form.formulation} onChange={e => setForm(f => ({ ...f, formulation: e.target.value }))}>
                {FORMULATIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div><label className="label">Strength</label><input className="input" placeholder="e.g. 500mg" value={form.strength} onChange={e => setForm(f => ({ ...f, strength: e.target.value }))} /></div>
            <div><label className="label">Price (₦) *</label><input className="input" type="number" min="0" step="any" required value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
            <div><label className="label">Stock quantity *</label><input className="input" type="number" min="0" required value={form.stock_quantity} onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.prescription_required} onChange={e => setForm(f => ({ ...f, prescription_required: e.target.checked }))} />
            Requires a prescription to dispense
          </label>
          <button type="submit" disabled={saving} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm disabled:opacity-50">
            {saving ? "Saving…" : "Add to Inventory"}
          </button>
        </form>
      )}

      <div className="flex items-center gap-4 flex-wrap">
        <input className="input max-w-xs" placeholder="Search inventory…" value={search} onChange={e => setSearch(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
      </div>

      {visibleDrugs.length === 0 ? (
        <div className="card p-12 text-center"><p className="text-4xl mb-3">💊</p><p className="font-semibold text-gray-700">No matching drugs</p></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Drug</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Formulation</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleDrugs.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{d.drug_name}{d.strength ? ` ${d.strength}` : ""}</p>
                      {d.generic_name && <p className="text-xs text-gray-400">{d.generic_name}</p>}
                      {d.prescription_required && <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded mt-0.5 inline-block">Rx required</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{d.formulation ?? "—"}</td>
                    <td className="px-4 py-3">
                      {editingId === d.id ? (
                        <input className="input w-24 text-sm" type="number" min="0" step="any" value={editValues.price}
                          onChange={e => setEditValues(v => ({ ...v, price: e.target.value }))} />
                      ) : (
                        <span className="text-gray-900 font-medium">₦{Number(d.price).toLocaleString()}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === d.id ? (
                        <input className="input w-20 text-sm" type="number" min="0" value={editValues.stock_quantity}
                          onChange={e => setEditValues(v => ({ ...v, stock_quantity: e.target.value }))} />
                      ) : (
                        <span className={d.stock_quantity > 0 ? "text-gray-700" : "text-red-600 font-medium"}>{d.stock_quantity}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        !d.active ? "bg-gray-100 text-gray-500" : d.stock_quantity > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {!d.active ? "Inactive" : d.stock_quantity > 0 ? "In stock" : "Out of stock"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {editingId === d.id ? (
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(d.id)} disabled={savingRow === d.id} className="text-xs text-blue-600 hover:underline font-medium">
                            {savingRow === d.id ? "Saving…" : "Save"}
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(d)} className="text-xs text-blue-600 hover:underline font-medium">Edit</button>
                          <button onClick={() => toggleActive(d.id, d.active)} disabled={savingRow === d.id}
                            className="text-xs text-gray-500 hover:text-gray-700">
                            {d.active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
