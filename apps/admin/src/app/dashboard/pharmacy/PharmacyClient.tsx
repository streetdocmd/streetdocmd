"use client";
import { useState } from "react";

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Awaiting Payment",
  sent:            "New",
  confirmed:       "Confirmed",
  dispensing:      "Dispensing",
  dispatched:      "Dispatched",
  delivered:       "Delivered",
  cancelled:       "Cancelled",
};
const STATUS_COLOR: Record<string, string> = {
  pending_payment: "bg-yellow-100 text-yellow-700",
  sent:            "bg-blue-100 text-blue-700",
  confirmed:       "bg-purple-100 text-purple-700",
  dispensing:      "bg-orange-100 text-orange-700",
  dispatched:      "bg-teal-100 text-teal-700",
  delivered:       "bg-green-100 text-green-700",
  cancelled:       "bg-red-100 text-red-700",
};

export default function PharmacyClient({
  orders,
  partners,
  staff,
  stats,
}: {
  orders: any[];
  partners: any[];
  staff: any[];
  stats: { totalCommission: number; totalRevenue: number; deliveredCount: number; flaggedCount: number };
}) {
  const [tab, setTab]             = useState<"orders" | "partners" | "staff">("orders");
  const [filter, setFilter]       = useState("all");
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ name: "", phone: "", email: "", address: "" });
  const [saving, setSaving]       = useState(false);
  const [partnerList, setPartners] = useState(partners);

  const filtered = filter === "all" ? orders
    : filter === "flagged" ? orders.filter(o => o.requires_review)
    : orders.filter(o => o.status === filter);

  async function createPartner(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/pharmacy/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const p = await res.json();
      setPartners(prev => [p, ...prev]);
      setForm({ name: "", phone: "", email: "", address: "" });
      setShowForm(false);
    }
    setSaving(false);
  }

  async function toggleActive(partner: any) {
    const res = await fetch(`/api/pharmacy/partners/${partner.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !partner.active }),
    });
    if (res.ok) setPartners(prev => prev.map(p => p.id === partner.id ? { ...p, active: !p.active } : p));
  }

  async function deletePartner(id: string) {
    if (!confirm("Delete this pharmacy partner?")) return;
    const res = await fetch(`/api/pharmacy/partners/${id}`, { method: "DELETE" });
    if (res.ok) setPartners(prev => prev.filter(p => p.id !== id));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Pharmacy & Drug Dispatch</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total Orders" value={String(orders.length)} />
        <Stat label="Delivered" value={String(stats.deliveredCount)} green />
        <Stat label="Total Revenue" value={`₦${Number(stats.totalRevenue).toLocaleString()}`} />
        <Stat label="Commission (8%)" value={`₦${Number(stats.totalCommission).toLocaleString()}`} teal />
      </div>

      {stats.flaggedCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-xl">
          ⚠ {stats.flaggedCount} order{stats.flaggedCount > 1 ? "s" : ""} flagged for controlled drug review.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(["orders", "partners", "staff"] as const).map(t => (
          <button key={t} onClick={() => setTab(t as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? "border-teal-brand text-teal-brand" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Orders tab */}
      {tab === "orders" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap text-sm">
            {[["all","All"], ["flagged","⚠ Flagged"], ["sent","New"], ["dispatched","Dispatched"], ["delivered","Delivered"]].map(([v, l]) => (
              <button key={v} onClick={() => setFilter(v)}
                className={`px-3 py-1.5 rounded-full font-medium ${filter === v ? "bg-teal-brand text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase text-left">
                  <th className="pb-3 pr-4">Patient</th>
                  <th className="pb-3 pr-4">Provider</th>
                  <th className="pb-3 pr-4">Pharmacy</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Amount</th>
                  <th className="pb-3 pr-4">Commission</th>
                  <th className="pb-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-gray-900">{(o.users as any)?.name ?? "—"}</p>
                      {o.requires_review && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Controlled</span>}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">Dr {(o.providers as any)?.name ?? "—"}</td>
                    <td className="py-3 pr-4 text-gray-600">{(o.pharmacy_partners as any)?.name ?? "—"}</td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-medium">{o.total_amount > 0 ? `₦${Number(o.total_amount).toLocaleString()}` : "—"}</td>
                    <td className="py-3 pr-4 text-teal-brand font-medium">{o.commission_amount > 0 ? `₦${Number(o.commission_amount).toLocaleString()}` : "—"}</td>
                    <td className="py-3 text-gray-400 text-xs">{new Date(o.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">No orders</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Staff tab */}
      {tab === "staff" && <PharmacyStaffPanel staff={staff} partners={partnerList} />}

      {/* Partners tab */}
      {tab === "partners" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Pharmacy Partners ({partnerList.length})</h2>
            <button onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-teal-brand text-white rounded-lg text-sm font-semibold hover:opacity-90">
              {showForm ? "Cancel" : "+ Add Partner"}
            </button>
          </div>

          {showForm && (
            <form onSubmit={createPartner} className="card p-5 space-y-4">
              <p className="font-semibold text-gray-900">New Pharmacy Partner</p>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
                <div><label className="label">Phone *</label><input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required /></div>
                <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><label className="label">Address</label><input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              </div>
              <button type="submit" disabled={saving}
                className="px-6 py-2 bg-teal-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {saving ? "Saving…" : "Create Partner"}
              </button>
            </form>
          )}

          <div className="space-y-3">
            {partnerList.map(p => (
              <div key={p.id} className="card p-5 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {p.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{p.phone}{p.email ? ` · ${p.email}` : ""}</p>
                  {p.address && <p className="text-sm text-gray-400">{p.address}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleActive(p)}
                    className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                    {p.active ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => deletePartner(p.id)}
                    className="text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50">
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {partnerList.length === 0 && (
              <div className="card p-12 text-center">
                <p className="text-4xl mb-3">💊</p>
                <p className="font-semibold text-gray-700">No pharmacy partners yet</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, green, teal }: { label: string; value: string; green?: boolean; teal?: boolean }) {
  return (
    <div className="card p-5">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${green ? "text-green-600" : teal ? "text-teal-brand" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function PharmacyStaffPanel({ staff, partners }: { staff: any[]; partners: any[] }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", pharmacy_partner_id: partners[0]?.id ?? "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  function setF(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, facility_type: "pharmacy", partner_id: form.pharmacy_partner_id }),
    });
    setSaving(false);
    if (res.ok) {
      const { temp_password } = await res.json();
      setToast(`Staff added. Temp password: ${temp_password}`);
      setShowForm(false);
      setForm({ name: "", email: "", phone: "", pharmacy_partner_id: partners[0]?.id ?? "" });
      setTimeout(() => { setToast(""); window.location.reload(); }, 4000);
    } else {
      setToast("Error creating staff account.");
    }
  }

  return (
    <div className="space-y-4">
      {toast && <div className="bg-gray-900 text-white px-5 py-3 rounded-xl text-sm">{toast}</div>}
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-teal-brand text-white rounded-lg text-sm font-semibold hover:opacity-90">
          {showForm ? "Cancel" : "+ Add Staff Member"}
        </button>
      </div>
      {showForm && (
        <form onSubmit={addStaff} className="card p-5 space-y-4">
          <p className="font-semibold text-gray-900">New Pharmacy Staff Member</p>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Name *</label><input className="input" required value={form.name} onChange={e => setF("name", e.target.value)} /></div>
            <div><label className="label">Email *</label><input className="input" type="email" required value={form.email} onChange={e => setF("email", e.target.value)} /></div>
            <div><label className="label">Phone</label><input className="input" type="tel" value={form.phone} onChange={e => setF("phone", e.target.value)} /></div>
            <div>
              <label className="label">Pharmacy Partner *</label>
              <select className="input" value={form.pharmacy_partner_id} onChange={e => setF("pharmacy_partner_id", e.target.value)} required>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-400">A login will be created and credentials sent to their phone via SMS.</p>
          <button type="submit" disabled={saving} className="px-6 py-2.5 bg-teal-brand text-white rounded-lg font-semibold text-sm disabled:opacity-50">
            {saving ? "Creating account…" : "Create Staff Account"}
          </button>
        </form>
      )}
      {staff.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">No pharmacy staff added yet.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Name","Email","Phone","Pharmacy"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff.map(s => {
                const u = s.users as any;
                const partner = partners.find((p: any) => p.id === s.pharmacy_partner_id);
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{u?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{u?.email ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{u?.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{partner?.name ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
