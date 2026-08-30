"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Setting = { key: string; value: any; description: string | null; updated_at: string };

export default function SettingsForm({ settings }: { settings: Setting[] }) {
  const followUpDiscount = settings.find(s => s.key === "follow_up_discount_rate");
  const otherSettings = settings.filter(s => s.key !== "follow_up_discount_rate");

  return (
    <div className="space-y-4">
      {followUpDiscount && <FollowUpDiscountCard setting={followUpDiscount} />}
      {otherSettings.map(s => <RawSettingCard key={s.key} setting={s} />)}
      {settings.length === 0 && (
        <div className="card p-8 text-center text-gray-400 text-sm">No settings configured yet.</div>
      )}
    </div>
  );
}

function FollowUpDiscountCard({ setting }: { setting: Setting }) {
  const router = useRouter();
  const supabase = createClient();
  const [percent, setPercent] = useState(String(Math.round(Number(setting.value) * 100)));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const rate = Number(percent) / 100;
    if (!(rate >= 0 && rate < 1)) {
      setError("Enter a percentage between 0 and 99.");
      return;
    }
    setSaving(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase
      .from("platform_settings")
      .update({ value: rate, updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq("key", "follow_up_discount_rate");
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="card p-5 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Follow-up Discount</h3>
        <p className="text-xs text-gray-400 mt-0.5">{setting.description}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <input
            type="number" min={0} max={99} step={1}
            className="input w-24"
            value={percent}
            onChange={e => { setPercent(e.target.value); setSaved(false); }}
          />
          <span className="text-sm text-gray-500">% below standard price</span>
        </div>
        <button type="submit" disabled={saving} className="btn-primary text-sm ml-auto">
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <p className="text-xs text-gray-400">
        Last updated {new Date(setting.updated_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
      </p>
    </form>
  );
}

// Fallback for any future setting added without a dedicated card yet —
// edits the raw JSON value directly rather than blocking on a UI update.
function RawSettingCard({ setting }: { setting: Setting }) {
  const router = useRouter();
  const supabase = createClient();
  const [raw, setRaw] = useState(JSON.stringify(setting.value, null, 2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    let parsed;
    try { parsed = JSON.parse(raw); } catch { setError("Invalid JSON."); return; }
    setSaving(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase
      .from("platform_settings")
      .update({ value: parsed, updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq("key", setting.key);
    setSaving(false);
    if (err) { setError(err.message); return; }
    router.refresh();
  }

  return (
    <form onSubmit={save} className="card p-5 space-y-2">
      <h3 className="text-sm font-semibold text-gray-900">{setting.key}</h3>
      {setting.description && <p className="text-xs text-gray-400">{setting.description}</p>}
      <textarea className="input font-mono text-xs" rows={3} value={raw} onChange={e => setRaw(e.target.value)} />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? "Saving…" : "Save"}</button>
    </form>
  );
}
