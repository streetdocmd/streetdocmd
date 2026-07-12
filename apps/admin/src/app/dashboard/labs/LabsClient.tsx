"use client";
import { useState } from "react";
import { formatNaira } from "@streetdocmd/shared";

const STATUS_LABELS: Record<string, string> = {
  ordered:                    "Ordered",
  confirmed:                  "Confirmed",
  sample_collector_dispatched:"Collector Out",
  sample_collected:           "Collected",
  processing:                 "Processing",
  resulted:                   "Resulted",
};
const STATUS_COLOR: Record<string, string> = {
  ordered:                    "bg-yellow-100 text-yellow-700",
  confirmed:                  "bg-blue-100 text-blue-700",
  sample_collector_dispatched:"bg-indigo-100 text-indigo-700",
  sample_collected:           "bg-purple-100 text-purple-700",
  processing:                 "bg-orange-100 text-orange-700",
  resulted:                   "bg-green-100 text-green-700",
};

type Tab = "orders" | "partners" | "staff";

export default function LabsClient({ orders, partners, staff, stats }: {
  orders: any[];
  partners: any[];
  staff: any[];
  stats: { totalOrders: number; resulted: number; commission: number };
}) {
  const [tab, setTab] = useState<Tab>("orders");
  const [showPartnerForm, setShowPartnerForm] = useState(false);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Lab Investigations</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Orders" value={stats.totalOrders.toString()} />
        <StatCard label="Resulted" value={stats.resulted.toString()} />
        <StatCard label="Commission Earned (15%)" value={formatNaira(stats.commission)} highlight />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["orders", "partners", "staff"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-teal-600 text-teal-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "orders" ? "Orders" : t === "partners" ? "Lab Partners" : "Staff"}
          </button>
        ))}
      </div>

      {tab === "orders"   && <OrdersTable orders={orders} />}
      {tab === "partners" && (
        <PartnersPanel
          partners={partners}
          showForm={showPartnerForm}
          setShowForm={setShowPartnerForm}
        />
      )}
      {tab === "staff"    && <StaffPanel staff={staff} partners={partners} />}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`card p-5 ${highlight ? "border-teal-200 bg-teal-50" : ""}`}>
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? "text-teal-700" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function OrdersTable({ orders }: { orders: any[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = orders.filter(o => {
    const nameMatch = (o.users?.name ?? "").toLowerCase().includes(search.toLowerCase());
    const statusMatch = statusFilter === "all" || o.status === statusFilter;
    return nameMatch && statusMatch;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input
          className="input flex-1"
          placeholder="Search by patient name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="input w-48" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {Object.keys(STATUS_LABELS).map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">No investigation orders found.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Patient", "Provider", "Lab", "Tests", "Total", "Status", "Date"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(o => {
                const total = (o.tests as any[])?.reduce((s: number, t: any) => s + (t.price ?? 0), 0) ?? 0;
                return (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{o.users?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{o.providers?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{o.lab_partners?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                      {(o.tests as any[])?.map((t: any) => t.test_name).join(", ")}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">₦{total.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(o.ordered_at).toLocaleDateString("en-NG")}
                    </td>
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

function PartnersPanel({ partners, showForm, setShowForm }: {
  partners: any[];
  showForm: boolean;
  setShowForm: (v: boolean) => void;
}) {
  const [form, setForm] = useState({ name: "", address: "", phone: "", email: "", lat: "", lng: "", home_collection_available: false });
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  function updateForm(k: keyof typeof form, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function addPartner(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/labs/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setShowForm(false);
    window.location.reload();
  }

  async function toggleActive(id: string, current: boolean) {
    setToggling(id);
    await fetch(`/api/labs/partners/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !current }),
    });
    setToggling(null);
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700"
        >
          {showForm ? "Cancel" : "+ Add Lab Partner"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addPartner} className="card p-5 space-y-4">
          <p className="font-semibold text-gray-900">New Lab Partner</p>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Name *</label><input className="input" required value={form.name} onChange={e => updateForm("name", e.target.value)} /></div>
            <div><label className="label">Phone *</label><input className="input" required value={form.phone} onChange={e => updateForm("phone", e.target.value)} /></div>
            <div className="col-span-2"><label className="label">Address *</label><input className="input" required value={form.address} onChange={e => updateForm("address", e.target.value)} /></div>
            <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => updateForm("email", e.target.value)} /></div>
            <div><label className="label">Latitude</label><input className="input" type="number" step="any" value={form.lat} onChange={e => updateForm("lat", e.target.value)} /></div>
            <div><label className="label">Longitude</label><input className="input" type="number" step="any" value={form.lng} onChange={e => updateForm("lng", e.target.value)} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.home_collection_available} onChange={e => updateForm("home_collection_available", e.target.checked)} />
            Home collection available
          </label>
          <button type="submit" disabled={saving} className="px-6 py-2.5 bg-teal-600 text-white rounded-lg font-semibold text-sm disabled:opacity-50">
            {saving ? "Saving…" : "Add Partner"}
          </button>
        </form>
      )}

      {partners.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">No lab partners added yet.</div>
      ) : (
        <div className="space-y-3">
          {partners.map(p => (
            <div key={p.id} className="card p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{p.name}</p>
                <p className="text-sm text-gray-500">{p.address} · {p.phone}</p>
                {p.home_collection_available && (
                  <span className="text-xs bg-teal-50 text-teal-600 border border-teal-200 rounded-full px-2 py-0.5 mt-1 inline-block">Home collection</span>
                )}
              </div>
              <button
                onClick={() => toggleActive(p.id, p.active)}
                disabled={toggling === p.id}
                className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  p.active
                    ? "bg-green-100 text-green-700 hover:bg-red-50 hover:text-red-600"
                    : "bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-700"
                }`}
              >
                {toggling === p.id ? "…" : p.active ? "Active" : "Inactive"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StaffPanel({ staff, partners }: { staff: any[]; partners: any[] }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", lab_partner_id: partners[0]?.id ?? "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  function setF(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, facility_type: "lab", partner_id: form.lab_partner_id }),
    });
    setSaving(false);
    if (res.ok) {
      const { temp_password } = await res.json();
      setToast(`Staff added. Temp password: ${temp_password}`);
      setShowForm(false);
      setForm({ name: "", email: "", phone: "", lab_partner_id: partners[0]?.id ?? "" });
      setTimeout(() => { setToast(""); window.location.reload(); }, 4000);
    } else {
      setToast("Error creating staff account.");
    }
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="bg-gray-900 text-white px-5 py-3 rounded-xl text-sm">{toast}</div>
      )}
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700">
          {showForm ? "Cancel" : "+ Add Staff Member"}
        </button>
      </div>
      {showForm && (
        <form onSubmit={addStaff} className="card p-5 space-y-4">
          <p className="font-semibold text-gray-900">New Lab Staff Member</p>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Name *</label><input className="input" required value={form.name} onChange={e => setF("name", e.target.value)} /></div>
            <div><label className="label">Email *</label><input className="input" type="email" required value={form.email} onChange={e => setF("email", e.target.value)} /></div>
            <div><label className="label">Phone</label><input className="input" type="tel" value={form.phone} onChange={e => setF("phone", e.target.value)} /></div>
            <div>
              <label className="label">Lab Partner *</label>
              <select className="input" value={form.lab_partner_id} onChange={e => setF("lab_partner_id", e.target.value)} required>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-400">A login will be created and credentials sent to their phone via SMS.</p>
          <button type="submit" disabled={saving} className="px-6 py-2.5 bg-teal-600 text-white rounded-lg font-semibold text-sm disabled:opacity-50">
            {saving ? "Creating account…" : "Create Staff Account"}
          </button>
        </form>
      )}
      {staff.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">No lab staff added yet.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Name","Email","Phone","Lab Partner"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff.map(s => {
                const u = s.users as any;
                const partner = partners.find((p: any) => p.id === s.lab_partner_id);
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
