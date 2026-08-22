"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { formatNaira, type Profession, type ProviderService } from "@streetdocmd/shared";

type ServiceRow = Pick<ProviderService, "id" | "name" | "description" | "price" | "duration_minutes" | "active">;

export default function ServicesClient({
  providerId, profession, initialServices,
}: {
  providerId: string;
  profession: Profession;
  initialServices: ServiceRow[];
}) {
  const supabase = createClient();
  const [services, setServices] = useState<ServiceRow[]>(initialServices);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", description: "", price: "", duration_minutes: "" });

  function set(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.price) {
      setError("Please enter a name and price.");
      return;
    }
    setSaving(true);
    setError("");

    const { data, error: err } = await supabase
      .from("provider_services")
      .insert({
        provider_id: providerId,
        profession,
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: parseFloat(form.price),
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
      })
      .select("id, name, description, price, duration_minutes, active, created_at")
      .single();

    setSaving(false);
    if (err || !data) {
      setError(err?.message ?? "Could not add service.");
      return;
    }
    setServices(prev => [data as ServiceRow, ...prev]);
    setForm({ name: "", description: "", price: "", duration_minutes: "" });
    setShowForm(false);
  }

  async function toggleActive(service: ServiceRow) {
    const { error: err } = await supabase
      .from("provider_services")
      .update({ active: !service.active, updated_at: new Date().toISOString() })
      .eq("id", service.id);
    if (!err) {
      setServices(prev => prev.map(s => s.id === service.id ? { ...s, active: !s.active } : s));
    }
  }

  return (
    <div className="space-y-4">
      {services.length === 0 && !showForm && (
        <div className="card p-8 text-center">
          <p className="text-3xl mb-2">🩺</p>
          <p className="font-semibold text-gray-700">No services yet</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Add a service so patients know what you offer and what it costs.</p>
          <button onClick={() => setShowForm(true)} className="btn-primary">Add a service</button>
        </div>
      )}

      {services.length > 0 && (
        <div className="space-y-2">
          {services.map(s => (
            <div key={s.id} className="card p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">{s.name}</p>
                  <span className={`badge ${s.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {s.active ? "Active" : "Inactive"}
                  </span>
                </div>
                {s.description && <p className="text-sm text-gray-500 mt-0.5">{s.description}</p>}
                <p className="text-sm font-medium text-teal-brand mt-1">
                  {formatNaira(s.price)}{s.duration_minutes ? ` · ${s.duration_minutes} min` : ""}
                </p>
              </div>
              <button
                onClick={() => toggleActive(s)}
                className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50 shrink-0"
              >
                {s.active ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
          {!showForm && (
            <button onClick={() => setShowForm(true)} className="text-sm text-teal-brand font-medium hover:underline">
              + Add another service
            </button>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={addService} className="card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">New service</h3>
          <div>
            <label className="label">Name</label>
            <input className="input" placeholder="e.g. Wound Care Visit" value={form.name} onChange={e => set("name", e.target.value)} required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} placeholder="What does this service include?" value={form.description} onChange={e => set("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Price (₦)</label>
              <input type="number" min="0" className="input" value={form.price} onChange={e => set("price", e.target.value)} required />
            </div>
            <div>
              <label className="label">Duration (minutes)</label>
              <input type="number" min="0" className="input" value={form.duration_minutes} onChange={e => set("duration_minutes", e.target.value)} />
            </div>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-600">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm">
              {saving ? "Saving…" : "Add service"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
