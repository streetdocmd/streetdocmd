"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ds";
import { ui } from "./ui";
import type { PortalType } from "./config";

// The patient-facing details a facility keeps current itself
export default function FacilityDetailsForm({ type, initial }: {
  type: PortalType;
  initial: {
    opening_hours: string | null; delivery_eta_minutes: number | null; services: string[];
    home_collection_available?: boolean; home_collection_fee?: number | null; service_radius_km?: number | null;
  };
}) {
  const router = useRouter();
  const [hours, setHours] = useState(initial.opening_hours ?? "");
  const [eta, setEta] = useState(initial.delivery_eta_minutes ? String(initial.delivery_eta_minutes) : "");
  const [services, setServices] = useState<string[]>(initial.services);
  const [draft, setDraft] = useState("");
  const [homeCollection, setHomeCollection] = useState(initial.home_collection_available !== false);
  const [fee, setFee] = useState(String(initial.home_collection_fee ?? 0));
  const [radius, setRadius] = useState(String(initial.service_radius_km ?? 25));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function addService() {
    const s = draft.trim();
    if (s && !services.includes(s)) setServices(v => [...v, s]);
    setDraft("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/facility/details", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type, opening_hours: hours, delivery_eta_minutes: eta, services,
        home_collection_available: homeCollection, home_collection_fee: fee, service_radius_km: radius,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setMsg({ ok: false, text: b.error ?? "Couldn't save. Please try again." });
      return;
    }
    setMsg({ ok: true, text: "Saved. Patients see the change straight away." });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="fd-hours" className={ui.label}>Opening hours</label>
          <input id="fd-hours" className={ui.input} maxLength={120} placeholder="e.g. Mon to Sat, 8am to 9pm"
            value={hours} onChange={e => setHours(e.target.value)} />
        </div>
        {type === "pharmacy" && (
          <div>
            <label htmlFor="fd-eta" className={ui.label}>Usual delivery time (minutes)</label>
            <input id="fd-eta" className={ui.input} inputMode="numeric" placeholder="e.g. 45"
              value={eta} onChange={e => setEta(e.target.value.replace(/\D/g, ""))} />
          </div>
        )}
      </div>

      {type === "lab" && (
        <div className="space-y-4 rounded-ds border border-line p-4">
          <label className="flex items-center justify-between gap-4">
            <span>
              <b className="block text-ds-sm text-ink">Home sample collection</b>
              <small className="text-ds-xs text-muted">Your collectors visit patients at home</small>
            </span>
            <input type="checkbox" className={ui.checkbox} checked={homeCollection} onChange={e => setHomeCollection(e.target.checked)} />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fd-fee" className={ui.label}>Home collection fee (₦)</label>
              <input id="fd-fee" className={ui.input} inputMode="numeric" value={fee} onChange={e => setFee(e.target.value.replace(/\D/g, ""))} />
              <p className={ui.hint}>Added to each home collection order. Not charged when a StreetdocMD doctor took the sample.</p>
            </div>
            <div>
              <label htmlFor="fd-radius" className={ui.label}>Service area (km from your lab)</label>
              <input id="fd-radius" className={ui.input} inputMode="numeric" value={radius} onChange={e => setRadius(e.target.value.replace(/\D/g, ""))} />
              <p className={ui.hint}>You&apos;re only sent orders within this distance.</p>
            </div>
          </div>
        </div>
      )}

      {type === "hospital" && (
        <div>
          <label htmlFor="fd-service" className={ui.label}>Services and specialist clinics</label>
          <div className="flex gap-2">
            <input id="fd-service" className={ui.input} maxLength={60} placeholder="e.g. Cardiology"
              value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addService(); } }} />
            <Button type="button" variant="secondary" size="sm" className="self-center" onClick={addService}>Add</Button>
          </div>
          {services.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {services.map(s => (
                <span key={s} className="inline-flex items-center gap-1.5 rounded-pill bg-teal-tint py-1.5 pl-3 pr-1.5 text-ds-sm font-semibold text-teal-deep">
                  {s}
                  <button type="button" onClick={() => setServices(v => v.filter(x => x !== s))} aria-label={`Remove ${s}`}
                    className="grid h-6 w-6 place-items-center rounded-full hover:bg-white/70">
                    <X size={13} aria-hidden />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-ds-sm font-semibold ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
      <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Save details"}</Button>
    </form>
  );
}
