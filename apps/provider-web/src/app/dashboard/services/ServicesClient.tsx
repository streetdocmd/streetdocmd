"use client";
import { useState } from "react";
import { Check, Stethoscope } from "lucide-react";
import { createClient } from "@/lib/supabase";
import EmptyState from "@/components/EmptyState";
import { formatNaira, SERVICE_LABELS, SERVICE_PRICES, SERVICE_PROFESSION, type Profession, type ProviderService, type ServiceType } from "@streetdocmd/shared";

type ServiceRow = Pick<ProviderService, "id" | "name" | "description" | "price" | "duration_minutes" | "active" | "service_type">;

const SELECT = "id, name, description, price, duration_minutes, active, service_type, created_at";
const MAX_RATE = 2_000_000;

// The bookable services this profession is dispatched for. Wellness Check is
// priced by the package the patient picks, so it has no provider rate.
function rateTypesFor(profession: Profession): ServiceType[] {
  return (Object.keys(SERVICE_PROFESSION) as ServiceType[])
    .filter(st => SERVICE_PROFESSION[st] === profession && st !== "wellness_check");
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
  const rateTypes = rateTypesFor(profession);

  // A rate is the active service row tied to a booking type; the booking API
  // charges it instead of the standard price (patient-web /api/bookings).
  const rateRow = (st: ServiceType) => services.find(s => s.active && s.service_type === st);
  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(rateTypes.map(st => {
      const row = initialServices.find(s => s.active && s.service_type === st);
      return [st, row ? String(Number(row.price)) : ""];
    })));
  const [savingRates, setSavingRates] = useState(false);
  const [ratesError, setRatesError] = useState("");
  const [ratesSaved, setRatesSaved] = useState(false);

  const dirty = rateTypes.some(st => {
    const row = rateRow(st);
    return (rates[st] ?? "").trim() !== (row ? String(Number(row.price)) : "");
  });

  async function saveRates(e: React.FormEvent) {
    e.preventDefault();
    if (savingRates) return;
    setRatesError("");
    setRatesSaved(false);

    const wanted: Record<string, number | null> = {};
    for (const st of rateTypes) {
      const raw = (rates[st] ?? "").replace(/[₦,\s]/g, "");
      if (!raw) { wanted[st] = null; continue; }
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
        setRatesError(`Enter your ${SERVICE_LABELS[st]} rate in whole naira, or leave it empty for the standard rate.`);
        return;
      }
      if (n > MAX_RATE) {
        setRatesError(`${SERVICE_LABELS[st]}: rates above ${formatNaira(MAX_RATE)} aren't accepted. Contact us if you need a higher rate.`);
        return;
      }
      wanted[st] = n;
    }

    setSavingRates(true);
    const now = new Date().toISOString();
    let next = services;
    try {
      for (const st of rateTypes) {
        const row = rateRow(st);
        const value = wanted[st];
        if (row && value === null) {
          // Back to the standard rate
          const { error } = await supabase.from("provider_services")
            .update({ active: false, updated_at: now }).eq("id", row.id);
          if (error) throw error;
          next = next.map(s => s.id === row.id ? { ...s, active: false } : s);
        } else if (row && value !== null && Number(row.price) !== value) {
          const { error } = await supabase.from("provider_services")
            .update({ price: value, updated_at: now }).eq("id", row.id);
          if (error) throw error;
          next = next.map(s => s.id === row.id ? { ...s, price: value } : s);
        } else if (!row && value !== null) {
          const { data, error } = await supabase.from("provider_services")
            .insert({ provider_id: providerId, profession, name: SERVICE_LABELS[st], price: value, service_type: st })
            .select(SELECT).single();
          if (error || !data) throw error ?? new Error("insert failed");
          next = [data as ServiceRow, ...next];
        }
      }
      setRatesSaved(true);
    } catch {
      setRatesError("Couldn't save every rate. Check your connection and try again.");
    } finally {
      setServices(next);
      setSavingRates(false);
    }
  }

  // ── Other services: informational listings, not tied to a booking price ──
  const listings = services.filter(s => !s.service_type);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", description: "", price: "", duration_minutes: "" });

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
      })
      .select(SELECT)
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
    if (err) {
      setError("Couldn't update that service. Please try again.");
      return;
    }
    setError("");
    setServices(prev => prev.map(s => s.id === service.id ? { ...s, active: !s.active } : s));
  }

  return (
    <div className="space-y-8">
      {rateTypes.length > 0 && (
        <section>
          <h2 className="text-[17px] font-bold text-navy">Your rates</h2>
          <p className="mb-3 mt-0.5 text-ds-sm text-muted">
            What you charge per visit. Leave a rate empty to use the standard rate.
          </p>
          <form onSubmit={saveRates} className="card divide-y divide-line">
            {rateTypes.map(st => {
              const custom = !!rateRow(st);
              return (
                <div key={st} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`rate-${st}`} className="block font-semibold text-ink">{SERVICE_LABELS[st]}</label>
                    <small className="block text-ds-xs text-muted">
                      Standard rate {formatNaira(SERVICE_PRICES[st])}{custom ? " · yours is set" : ""}
                    </small>
                  </div>
                  <div className="relative w-32 shrink-0 sm:w-40">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted">₦</span>
                    <input
                      id={`rate-${st}`}
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      className="input pl-8"
                      placeholder="Standard"
                      value={rates[st] ?? ""}
                      onChange={e => { setRates(r => ({ ...r, [st]: e.target.value })); setRatesSaved(false); setRatesError(""); }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="space-y-3 p-4">
              <p className="text-ds-xs text-muted">
                Patients pay your rate with nothing added. You receive 80 percent and StreetdocMD keeps 20 percent. Follow up visits get the usual follow up discount.
              </p>
              {ratesError && <p role="alert" className="text-ds-sm font-semibold text-danger">{ratesError}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={savingRates || !dirty} className="btn-primary">
                  {savingRates ? "Saving…" : "Save rates"}
                </button>
                {ratesSaved && !dirty && (
                  <span className="inline-flex items-center gap-1 text-ds-sm font-semibold text-success">
                    <Check size={16} aria-hidden /> Saved. New bookings use these rates.
                  </span>
                )}
              </div>
            </div>
          </form>
        </section>
      )}

      <section>
        <h2 className="text-[17px] font-bold text-navy">Other services you offer</h2>
        <p className="mb-3 mt-0.5 text-ds-sm text-muted">
          Optional. Describe anything else you do so patients know what to ask for.
        </p>

        <div className="space-y-4">
          {listings.length === 0 && !showForm && (
            <EmptyState
              icon={Stethoscope}
              title="No other services listed"
              description="Add a service so patients know what else you offer and what it costs."
            >
              <button onClick={() => setShowForm(true)} className="btn-secondary">Add a service</button>
            </EmptyState>
          )}

          {error && !showForm && (
            <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
          )}

          {listings.length > 0 && (
            <div className="space-y-2">
              {listings.map(s => (
                <div key={s.id} className="card p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-ink">{s.name}</p>
                      <span className={`badge ${s.active ? "bg-green-100 text-green-700" : "bg-pending-bg text-muted"}`}>
                        {s.active ? "Active" : "Inactive"}
                      </span>
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
                <input className="input" placeholder="e.g. Catheter change" value={form.name} onChange={e => set("name", e.target.value)} required />
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
      </section>
    </div>
  );
}
