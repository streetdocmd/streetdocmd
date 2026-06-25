"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

interface Profile {
  providerId: string;
  bio: string | null;
  years_experience: number;
  service_radius_km: number;
  working_hours_start: string | null;
  working_hours_end: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
}

export default function EditProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [form, setForm] = useState({
    bio: profile.bio ?? "",
    years_experience: String(profile.years_experience),
    service_radius_km: String(profile.service_radius_km),
    working_hours_start: profile.working_hours_start ?? "08:00",
    working_hours_end: profile.working_hours_end ?? "20:00",
    bank_name: profile.bank_name ?? "",
    bank_account_number: profile.bank_account_number ?? "",
    bank_account_name: profile.bank_account_name ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.from("providers").update({
      bio: form.bio || null,
      years_experience: parseInt(form.years_experience) || 0,
      service_radius_km: parseInt(form.service_radius_km) || 10,
      working_hours_start: form.working_hours_start || null,
      working_hours_end: form.working_hours_end || null,
      bank_name: form.bank_name || null,
      bank_account_number: form.bank_account_number || null,
      bank_account_name: form.bank_account_name || null,
    }).eq("id", profile.providerId);

    if (err) { setError(err.message); setSaving(false); return; }
    setSaved(true);
    setSaving(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-gray-900">Professional details</h3>
        <div>
          <label className="label">Bio / About you</label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Brief description of your experience and approach…"
            value={form.bio}
            onChange={e => set("bio", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Years of experience</label>
            <input type="number" min="0" max="50" className="input" value={form.years_experience} onChange={e => set("years_experience", e.target.value)} />
          </div>
          <div>
            <label className="label">Service radius (km)</label>
            <input type="number" min="1" max="50" className="input" value={form.service_radius_km} onChange={e => set("service_radius_km", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Working hours start</label>
            <input type="time" className="input" value={form.working_hours_start} onChange={e => set("working_hours_start", e.target.value)} />
          </div>
          <div>
            <label className="label">Working hours end</label>
            <input type="time" className="input" value={form.working_hours_end} onChange={e => set("working_hours_end", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-gray-900">Bank details (for payouts)</h3>
        <div>
          <label className="label">Bank name</label>
          <input className="input" placeholder="e.g. Access Bank" value={form.bank_name} onChange={e => set("bank_name", e.target.value)} />
        </div>
        <div>
          <label className="label">Account number</label>
          <input className="input" placeholder="10-digit account number" maxLength={10} value={form.bank_account_number} onChange={e => set("bank_account_number", e.target.value)} />
        </div>
        <div>
          <label className="label">Account name</label>
          <input className="input" placeholder="As it appears on your bank statement" value={form.bank_account_name} onChange={e => set("bank_account_name", e.target.value)} />
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button type="submit" className="btn-primary w-full" disabled={saving}>
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
      </button>
    </form>
  );
}