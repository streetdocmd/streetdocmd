"use client";
import { useState } from "react";
import { Stethoscope } from "lucide-react";
import { createClient } from "@/lib/supabase";
import EmptyState from "@/components/EmptyState";
import { formatNaira, SERVICE_LABELS, SERVICE_PROFESSION, type Profession, type ProviderService, type ServiceType } from "@streetdocmd/shared";

type ServiceRow = Pick<ProviderService, "id" | "name" | "description" | "price" | "duration_minutes" | "active" | "service_type">;

// The bookable service types this profession can be dispatched for — a
// service listing can optionally be tied to one of these so its price is
// actually used when a patient books that service, instead of the global
// SERVICE_PRICES default.
function bookableTypesFor(profession: Profession): ServiceType[] {
  return (Object.keys(SERVICE_PROFESSION) as ServiceType[]).filter(st => SERVICE_PROFESSION[st] === profession);
}

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
  const [form, setForm] = useState({ name: "", description: "", price: "", duration_minutes: "", service_type: "" });
  const bookableTypes = bookableTypesFor(profession);

  function set(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!form.name.trim() || !form.price) {
      setError("Please enter a name and price.");
      return;
    }
    if (!(parseFloat(form.price) > 0)) {
      setError("Please enter a price greater than ₦0.");
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
        service_type: form.service_type || null,
      })
      .select("id, name, description, price, duration_minutes, active, service_type, created_at")
      .single();

    setSaving(false);
    if (err || !data) {
      // provider_services_provider_service_type_idx rejects a second active
      // service mapped to a service_type this provider already has one for.
      setError(err?.message?.includes("provider_services_provider_service_type_idx")
        ? "You already have an active service for that booking type — deactivate it first."
        : err?.message ?? "Could not add service.");
      return;
    }
    setServices(prev => [data as ServiceRow, ...prev]);
    setForm({ name: "", description: "", price: "", duration_minutes: "", service_type: "" });
    setShowForm(false);
  }

  async function toggleActive(service: ServiceRow) {
    const { error: err } = await supabase
      .from("provider_services")
      .update({ active: !service.active, updated_at: new Date().toISOString() })
      .eq("id", service.id);
    if (err) {
      setError(err.message.includes("provider_services_provider_service_type_idx")
        ? "You already have an active service for that booking type — deactivate it first."
        : "Couldn't update that service — please try again.");
      return;
    }
    setError("");
    setServices(prev => prev.map(s => s.id === service.id ? { ...s, active: !s.active } : s));
  }

  return (
    <div className="space-y-4">
      {services.length === 0 && !showForm && (
        <EmptyState
          icon={Stethoscope}
          title="No services yet"
          description="Add a service so patients know what you offer and what it costs."
        >
          <button onClick={() => setShowForm(true)} className="btn-primary">Add a service</button>
        </EmptyState>
      )}

      {error && !showForm && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {services.length > 0 && (
        <div className="space-y-2">
          {services.map(s => (
            <div key={s.id} className="card p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-ink">{s.name}</p>
                  <span className={`badge ${s.active ? "bg-green-100 text-green-700" : "bg-pending-bg text-muted"}`}>
                    {s.active ? "Active" : "Inactive"}
                  </span>
                  {s.service_type && (
                    <span className="badge bg-teal-50 text-teal-700 border border-teal-100">
                      Prices "{(SERVICE_LABELS as Record<string, string>)[s.service_type]}" bookings
                    </span>
                  )}
                </div>
                {s.description && <p className="text-sm text-muted mt-0.5">{s.description}</p>}
                <p className="text-sm font-medium text-teal-deep mt-1">
                  {formatNaira(s.price)}{s.duration_minutes ? ` · ${s.duration_minutes} min` : ""}
                </p>
              </div>
              <button
                onClick={() => toggleActive(s)}
                className="text-xs border border-line rounded-lg px-3 py-1.5 text-muted hover:bg-page shrink-0"
              >
                {s.active ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
          {!showForm && (
            <button onClick={() => setShowForm(true)} className="text-sm text-accent font-medium hover:underline">
              + Add another service
            </button>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={addService} className="card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-ink">New service</h3>
          <div>
            <label className="label">Name</label>
            <input className="input" placeholder="e.g. Wound Care Visit" value={form.name} onChange={e => set("name", e.target.value)} required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} placeholder="What does this service include?" value={form.description} onChange={e => set("description", e.target.value)} />
          </div>
          {bookableTypes.length > 0 && (
            <div>
              <label className="label">Set the price for a booking type (optional)</label>
              <select className="input" value={form.service_type} onChange={e => set("service_type", e.target.value)}>
                <option value="">Just a listing — don't override any booking price</option>
                {bookableTypes.map(st => (
                  <option key={st} value={st}>{SERVICE_LABELS[st]}</option>
                ))}
              </select>
              <p className="text-xs text-muted mt-1">
                If set, patients booking this service type from you will pay this price instead of the standard rate.
              </p>
            </div>
          )}
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
            <button type="button" onClick={() => { setShowForm(false); setError(""); }} className="btn-secondary flex-1">
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
