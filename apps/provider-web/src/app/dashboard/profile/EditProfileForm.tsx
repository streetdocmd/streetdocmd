"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase";

interface Profile {
  providerId: string;
  bio: string | null;
  languages: string[] | null;
  years_experience: number;
  service_radius_km: number;
  working_hours_start: string | null;
  working_hours_end: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
}

// Postgres `time` comes back as "08:00:00"; <input type="time"> wants "08:00".
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");

export default function EditProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [form, setForm] = useState({
    bio: profile.bio ?? "",
    languages: (profile.languages ?? []).join(", "),
    years_experience: String(profile.years_experience ?? 0),
    service_radius_km: String(profile.service_radius_km ?? 10),
    working_hours_start: hhmm(profile.working_hours_start) || "08:00",
    working_hours_end: hhmm(profile.working_hours_end) || "20:00",
    bank_name: profile.bank_name ?? "",
    bank_account_number: profile.bank_account_number ?? "",
    bank_account_name: profile.bank_account_name ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function set(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setSaved(false);
    if (error) setError("");
  }

  function validate(): string | null {
    const radius = parseInt(form.service_radius_km);
    if (!radius || radius < 1 || radius > 50) return "Service radius must be between 1 and 50 km.";
    const years = parseInt(form.years_experience || "0");
    if (Number.isNaN(years) || years < 0 || years > 60) return "Years of experience must be between 0 and 60.";
    if (form.working_hours_start && form.working_hours_end && form.working_hours_end <= form.working_hours_start) {
      return "Your working hours must end after they start.";
    }
    const anyBank = form.bank_name.trim() || form.bank_account_number.trim() || form.bank_account_name.trim();
    if (anyBank) {
      if (!form.bank_name.trim() || !form.bank_account_name.trim()) {
        return "Please complete all three bank fields (bank, account number and account name).";
      }
      if (!/^\d{10}$/.test(form.bank_account_number.trim())) {
        return "Your account number must be exactly 10 digits (NUBAN).";
      }
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const problem = validate();
    if (problem) { setError(problem); return; }

    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.from("providers").update({
      bio: form.bio.trim() || null,
      languages: form.languages.split(",").map(l => l.trim()).filter(Boolean),
      years_experience: parseInt(form.years_experience) || 0,
      service_radius_km: parseInt(form.service_radius_km) || 10,
      working_hours_start: form.working_hours_start || null,
      working_hours_end: form.working_hours_end || null,
      bank_name: form.bank_name.trim() || null,
      bank_account_number: form.bank_account_number.trim() || null,
      bank_account_name: form.bank_account_name.trim() || null,
    }).eq("id", profile.providerId);

    setSaving(false);
    if (err) { setError("Couldn't save your changes — please check your connection and try again."); return; }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div id="about" className="card p-5 space-y-4 scroll-mt-24">
        <div>
          <h3 className="font-semibold text-ink">About you</h3>
          <p className="text-xs text-muted mt-0.5">Shown to patients when you&apos;re matched to their visit.</p>
        </div>
        <div>
          <label className="label" htmlFor="bio">Bio</label>
          <textarea
            id="bio"
            className="input resize-none"
            rows={3}
            maxLength={600}
            placeholder="e.g. GP with 6 years' experience in family medicine. I speak English and Yoruba and enjoy caring for older patients at home."
            value={form.bio}
            onChange={e => set("bio", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_10rem] gap-4">
          <div>
            <label className="label" htmlFor="languages">Languages spoken</label>
            <input
              id="languages"
              className="input"
              placeholder="e.g. English, Yoruba, Pidgin"
              value={form.languages}
              onChange={e => set("languages", e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="years">Years of experience</label>
            <input id="years" type="number" inputMode="numeric" min="0" max="60" className="input" value={form.years_experience} onChange={e => set("years_experience", e.target.value)} />
          </div>
        </div>
      </div>

      <div id="availability" className="card p-5 space-y-4 scroll-mt-24">
        <div>
          <h3 className="font-semibold text-ink">Working hours & service area</h3>
          <p className="text-xs text-muted mt-0.5">We only send you requests inside these hours and within this distance of you.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className="label" htmlFor="start">Start</label>
            <input id="start" type="time" className="input" value={form.working_hours_start} onChange={e => set("working_hours_start", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="end">End</label>
            <input id="end" type="time" className="input" value={form.working_hours_end} onChange={e => set("working_hours_end", e.target.value)} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label" htmlFor="radius">Service radius (km)</label>
            <input id="radius" type="number" inputMode="numeric" min="1" max="50" className="input" value={form.service_radius_km} onChange={e => set("service_radius_km", e.target.value)} />
          </div>
        </div>
      </div>

      <div id="payouts" className="card p-5 space-y-4 scroll-mt-24">
        <div>
          <h3 className="font-semibold text-ink">Bank details for payouts</h3>
          <p className="text-xs text-muted mt-0.5">Withdrawals are paid into this account. The account name should match your registered name.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="bank_name">Bank</label>
            <input id="bank_name" className="input" placeholder="e.g. Access Bank" value={form.bank_name} onChange={e => set("bank_name", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="acct">Account number</label>
            <input
              id="acct"
              className="input tracking-wider"
              inputMode="numeric"
              placeholder="10-digit NUBAN"
              maxLength={10}
              value={form.bank_account_number}
              onChange={e => set("bank_account_number", e.target.value.replace(/\D/g, ""))}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="acct_name">Account name</label>
          <input id="acct_name" className="input" placeholder="As it appears on your bank statement" value={form.bank_account_name} onChange={e => set("bank_account_name", e.target.value)} />
        </div>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary inline-flex items-center justify-center gap-2 w-full sm:w-auto" disabled={saving}>
          {saving && <Loader2 size={16} className="animate-spin" />}
          {saving ? "Saving…" : "Save changes"}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-green-700 shrink-0">
            <CheckCircle2 size={16} /> Saved
          </span>
        )}
      </div>
    </form>
  );
}
