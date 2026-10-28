"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Stepper, cx } from "@/components/ds";
import { Card, ui } from "@/components/portal/ui";

export interface Ward {
  id: string;
  ward_name: string;
  total_beds: number;
  free_beds: number;
  updated_at: string;
}

async function send(method: string, body?: object, query = "") {
  const res = await fetch(`/api/hospital-portal/capacity${query}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong. Please try again.");
  return json;
}

export default function CapacityClient({ initial }: { initial: Ward[] }) {
  const [wards, setWards] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [total, setTotal] = useState("");
  const [saving, setSaving] = useState(false);
  // Debounce stepper taps per ward so a run of taps is one save
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function setFree(w: Ward, free: number) {
    setError(null);
    setWards(ws => ws.map(x => (x.id === w.id ? { ...x, free_beds: free } : x)));
    clearTimeout(timers.current[w.id]);
    timers.current[w.id] = setTimeout(() => {
      send("PATCH", { id: w.id, free_beds: free }).catch((e: Error) => {
        setError(e.message);
        setWards(ws => ws.map(x => (x.id === w.id ? { ...x, free_beds: w.free_beds } : x)));
      });
    }, 600);
  }

  async function addWard(e: React.FormEvent) {
    e.preventDefault();
    const beds = Number(total);
    if (!name.trim() || !Number.isInteger(beds) || beds < 0) {
      setError("Enter a ward name and the number of beds.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { ward } = await send("POST", { ward_name: name, total_beds: beds });
      setWards(ws => [...ws, ward].sort((a, b) => a.ward_name.localeCompare(b.ward_name)));
      setName(""); setTotal(""); setAdding(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function removeWard(w: Ward) {
    if (!confirm(`Remove ${w.ward_name}? Patients will no longer see its beds.`)) return;
    setError(null);
    try {
      await send("DELETE", undefined, `?id=${encodeURIComponent(w.id)}`);
      setWards(ws => ws.filter(x => x.id !== w.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="rounded-ds-sm bg-danger-bg px-4 py-3 text-ds-sm font-semibold text-danger">{error}</p>}

      <Card className="px-4 py-1.5">
        {wards.length === 0 && !adding && (
          <p className="py-4 text-ds-sm text-muted">Add your wards to show free beds to patients and doctors.</p>
        )}
        {wards.map(w => {
          const pct = w.total_beds ? Math.round(((w.total_beds - w.free_beds) / w.total_beds) * 100) : 100;
          const full = w.free_beds === 0;
          const low = !full && w.free_beds <= 3;
          return (
            <div key={w.id} className="flex flex-wrap items-center gap-3 border-b border-line py-3.5 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <b className="text-ds-control text-ink">{w.ward_name}</b>
                  <button type="button" onClick={() => removeWard(w)} aria-label={`Remove ${w.ward_name}`}
                    className="rounded-lg p-1 text-muted hover:bg-page hover:text-danger">
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
                <small className="text-ds-xs text-muted">
                  {full ? "Full" : `${w.free_beds} of ${w.total_beds} beds free`}
                </small>
                <div className="mt-2 h-2 overflow-hidden rounded-pill bg-line" aria-hidden>
                  <span className={cx("block h-full rounded-pill", full ? "bg-danger" : low ? "bg-warn" : "bg-teal-deep")} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <Stepper size="sm" label={`Free beds, ${w.ward_name}`} value={w.free_beds} max={w.total_beds} onChange={v => setFree(w, v)} />
            </div>
          );
        })}

        {adding && (
          <form onSubmit={addWard} className="grid gap-3 border-t border-line py-4 first:border-0 sm:grid-cols-[1fr_140px]">
            <div>
              <label htmlFor="ward-name" className={ui.label}>Ward name</label>
              <input id="ward-name" className={ui.input} value={name} onChange={e => setName(e.target.value)} placeholder="Maternity" maxLength={60} autoFocus />
            </div>
            <div>
              <label htmlFor="ward-beds" className={ui.label}>Total beds</label>
              <input id="ward-beds" className={ui.input} inputMode="numeric" value={total} onChange={e => setTotal(e.target.value.replace(/\D/g, ""))} placeholder="20" />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" size="sm" disabled={saving}>{saving ? "Adding…" : "Add ward"}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setError(null); }}>Cancel</Button>
            </div>
          </form>
        )}
      </Card>

      {!adding && (
        <Button variant="secondary" size="sm" onClick={() => setAdding(true)}><Plus size={16} aria-hidden /> Add a ward</Button>
      )}
      <p className="text-ds-xs text-muted">Changes here update what patients see in search within a minute.</p>
    </div>
  );
}
