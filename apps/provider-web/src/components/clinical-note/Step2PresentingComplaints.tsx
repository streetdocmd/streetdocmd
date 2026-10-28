"use client";
import { useState } from "react";

type Complaint = { description: string; duration_value: string; duration_unit: string };

const blank = (): Complaint => ({ description: "", duration_value: "", duration_unit: "Days" });

export default function Step2PresentingComplaints({ value, onChange }: {
  value: Complaint[] | null;
  onChange: (v: Complaint[]) => void;
}) {
  const [complaints, setComplaints] = useState<Complaint[]>(value ?? [blank()]);

  const update = (next: Complaint[]) => {
    setComplaints(next);
    onChange(next);
  };

  const updateField = (i: number, field: keyof Complaint, val: string) => {
    const next = complaints.map((c, idx) => idx === i ? { ...c, [field]: val } : c);
    update(next);
  };

  const add = () => { if (complaints.length < 5) update([...complaints, blank()]); };
  const remove = (i: number) => { update(complaints.filter((_, idx) => idx !== i)); };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-ds-lg font-bold text-navy">Step 2 — Presenting Complaints</h2>
        <p className="text-sm text-muted mt-0.5">Acute Issues / Presenting Complaints <span className="text-red-500">*Required</span></p>
      </div>

      {complaints.map((c, i) => (
        <div key={i} className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Complaint {i + 1}</p>
            {i > 0 && (
              <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 text-sm font-medium">✕ Remove</button>
            )}
          </div>
          <textarea
            value={c.description}
            onChange={e => updateField(i, "description", e.target.value)}
            placeholder="Describe the complaint..."
            rows={3}
            className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted mb-1 block">Duration</label>
              <input
                type="number"
                min="1"
                value={c.duration_value}
                onChange={e => updateField(i, "duration_value", e.target.value)}
                placeholder="e.g. 3"
                className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted mb-1 block">Unit</label>
              <select
                value={c.duration_unit}
                onChange={e => updateField(i, "duration_unit", e.target.value)}
                className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white"
              >
                {["Hours", "Days", "Weeks", "Months"].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
        </div>
      ))}

      {complaints.length < 5 && (
        <button onClick={add} className="w-full border-2 border-dashed border-line rounded-xl py-3 text-sm text-muted hover:border-accent hover:text-accent transition-colors font-medium">
          + Add Another Complaint
        </button>
      )}
    </div>
  );
}
