"use client";
import { useState } from "react";

const URGENCY_COLOR: Record<string, string> = {
  emergency: "bg-red-100 text-red-700",
  urgent:    "bg-amber-100 text-amber-700",
  routine:   "bg-gray-100 text-gray-600",
};

const STATUS_COLOR: Record<string, string> = {
  pending:      "bg-yellow-100 text-yellow-700",
  acknowledged: "bg-blue-100 text-blue-700",
  in_progress:  "bg-purple-100 text-purple-700",
  completed:    "bg-green-100 text-green-700",
  cancelled:    "bg-red-100 text-red-700",
};

type Tab = "referrals" | "partners";

export default function HospitalsClient({
  referrals,
  partners,
  stats,
}: {
  referrals: any[];
  partners: any[];
  stats: { totalReferrals: number; pendingCount: number; inProgressCount: number; completedCount: number; emergencyCount: number };
}) {
  const [tab, setTab]       = useState<Tab>("referrals");
  const [filter, setFilter] = useState("all");
  const [partnerList, setPartners] = useState(partners);
  const [showForm, setShowForm]    = useState(false);
  const [saving, setSaving]        = useState(false);
  const [toggling, setToggling]    = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", address: "", phone: "", email: "",
    lat: "", lng: "", hospital_level: "secondary",
    emergency_available: true, ambulance_available: false,
    bed_count: "", specialties: [] as string[],
  });

  const filtered = filter === "all" ? referrals
    : filter === "emergency" ? referrals.filter(r => r.urgency === "emergency")
    : referrals.filter(r => r.status === filter);

  const SPECIALTIES = [
    "Cardiology","Neurology","Oncology","Orthopaedics","Paediatrics",
    "Obstetrics & Gynaecology","Surgery","Internal Medicine","Psychiatry",
    "Ophthalmology","ENT","Dermatology","Nephrology","Endocrinology","ICU",
  ];

  async function createPartner(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/hospitals/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
        bed_count: form.bed_count ? parseInt(form.bed_count) : null,
      }),
    });
    if (res.ok) {
      const p = await res.json();
      setPartners(prev => [p, ...prev]);
      setShowForm(false);
      setForm({ name: "", address: "", phone: "", email: "", lat: "", lng: "", hospital_level: "secondary", emergency_available: true, ambulance_available: false, bed_count: "", specialties: [] });
    }
    setSaving(false);
  }

  async function toggleActive(id: string, current: boolean) {
    setToggling(id);
    const res = await fetch(`/api/hospitals/partners/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !current }),
    });
    if (res.ok) setPartners(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p));
    setToggling(null);
  }

  function toggleSpecialty(s: string) {
    setForm(f => ({
      ...f,
      specialties: f.specialties.includes(s) ? f.specialties.filter(x => x !== s) : [...f.specialties, s],
    }));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Hospitals & Referrals</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="Total Referrals"   value={String(stats.totalReferrals)} />
        <Stat label="Pending"           value={String(stats.pendingCount)} yellow />
        <Stat label="In Progress"       value={String(stats.inProgressCount)} />
        <Stat label="Completed"         value={String(stats.completedCount)} green />
        <Stat label="Emergencies"       value={String(stats.emergencyCount)} red />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["referrals", "partners"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t ? "border-teal-brand text-teal-brand" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t === "referrals" ? "Referrals" : "Hospital Partners"}
          </button>
        ))}
      </div>

      {/* Referrals tab */}
      {tab === "referrals" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap text-sm">
            {[["all","All"],["emergency","🚨 Emergency"],["pending","Pending"],["acknowledged","Acknowledged"],["in_progress","In Progress"],["completed","Completed"]].map(([v,l]) => (
              <button key={v} onClick={() => setFilter(v)}
                className={`px-3 py-1.5 rounded-full font-medium ${filter === v ? "bg-teal-brand text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {l}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="card p-12 text-center text-gray-400">No referrals</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Patient","Provider","Hospital","Urgency","Status","Date","Letter"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{(r.users as any)?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-600">Dr {(r.providers as any)?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{(r.hospital_partners as any)?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${URGENCY_COLOR[r.urgency] ?? "bg-gray-100 text-gray-600"}`}>
                          {r.urgency}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {r.referred_at ? new Date(r.referred_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {r.pdf_url && (
                          <a href={r.pdf_url} target="_blank" rel="noreferrer" className="text-xs text-teal-brand hover:underline font-medium">View</a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Partners tab */}
      {tab === "partners" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Hospital Partners ({partnerList.length})</h2>
            <button onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-teal-brand text-white rounded-lg text-sm font-semibold hover:opacity-90">
              {showForm ? "Cancel" : "+ Add Hospital"}
            </button>
          </div>

          {showForm && (
            <form onSubmit={createPartner} className="card p-5 space-y-4">
              <p className="font-semibold text-gray-900">New Hospital Partner</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="label">Name *</label><input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div className="col-span-2"><label className="label">Address *</label><input className="input" required value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
                <div><label className="label">Phone *</label><input className="input" required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><label className="label">Latitude</label><input className="input" type="number" step="any" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} /></div>
                <div><label className="label">Longitude</label><input className="input" type="number" step="any" value={form.lng} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} /></div>
                <div>
                  <label className="label">Hospital Level *</label>
                  <select className="input" value={form.hospital_level} onChange={e => setForm(f => ({ ...f, hospital_level: e.target.value }))}>
                    {["primary","secondary","tertiary","specialist","teaching"].map(l => <option key={l} value={l} className="capitalize">{l}</option>)}
                  </select>
                </div>
                <div><label className="label">Bed Count</label><input className="input" type="number" value={form.bed_count} onChange={e => setForm(f => ({ ...f, bed_count: e.target.value }))} /></div>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.emergency_available} onChange={e => setForm(f => ({ ...f, emergency_available: e.target.checked }))} />
                  Emergency dept
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.ambulance_available} onChange={e => setForm(f => ({ ...f, ambulance_available: e.target.checked }))} />
                  Ambulance service
                </label>
              </div>
              <div>
                <label className="label mb-2 block">Specialties</label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTIES.map(s => (
                    <button key={s} type="button" onClick={() => toggleSpecialty(s)}
                      className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${form.specialties.includes(s) ? "bg-teal-brand text-white border-teal-brand" : "border-gray-200 text-gray-600 hover:border-teal-brand"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={saving}
                className="px-6 py-2.5 bg-teal-brand text-white rounded-lg font-semibold text-sm disabled:opacity-50">
                {saving ? "Saving…" : "Create Hospital Partner"}
              </button>
            </form>
          )}

          <div className="space-y-3">
            {partnerList.map(p => (
              <div key={p.id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{p.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {p.active ? "Active" : "Inactive"}
                      </span>
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full capitalize">{p.hospital_level}</span>
                      {p.emergency_available && <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">Emergency</span>}
                    </div>
                    <p className="text-sm text-gray-500">{p.address}</p>
                    <p className="text-sm text-gray-400">{p.phone}{p.email ? ` · ${p.email}` : ""}</p>
                    {Array.isArray(p.specialties) && p.specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.specialties.map((s: string) => (
                          <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => toggleActive(p.id, p.active)} disabled={toggling === p.id}
                    className={`text-xs px-3 py-1.5 border rounded-lg shrink-0 ${p.active ? "border-gray-200 text-gray-600 hover:bg-gray-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}>
                    {toggling === p.id ? "…" : p.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))}
            {partnerList.length === 0 && (
              <div className="card p-12 text-center">
                <p className="text-4xl mb-3">🏥</p>
                <p className="font-semibold text-gray-700">No hospital partners yet</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, green, yellow, red }: { label: string; value: string; green?: boolean; yellow?: boolean; red?: boolean }) {
  return (
    <div className="card p-5">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${green ? "text-green-600" : yellow ? "text-amber-500" : red ? "text-red-600" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
