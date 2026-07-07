"use client";
import { useState } from "react";

const FINDINGS = [
  "Alert and Oriented", "Pale", "Jaundiced", "Dehydrated",
  "Febrile", "Cyanosed", "Oedematous", "Well-nourished",
  "Acutely ill-looking", "Chronically ill-looking", "Not in obvious distress",
];

export default function Step8GeneralExamination({ value, onChange }: {
  value: { selected: string[]; additional: string } | null;
  onChange: (v: { selected: string[]; additional: string }) => void;
}) {
  const [selected, setSelected] = useState<string[]>(value?.selected ?? []);
  const [additional, setAdditional] = useState(value?.additional ?? "");

  const toggle = (f: string) => {
    const next = selected.includes(f) ? selected.filter(x => x !== f) : [...selected, f];
    setSelected(next);
    onChange({ selected: next, additional });
  };

  const updateAdditional = (v: string) => {
    setAdditional(v);
    onChange({ selected, additional: v });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Step 8 — General Examination</h2>
        <p className="text-sm text-gray-500 mt-0.5">Select all that apply</p>
      </div>

      <div className="card p-4 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FINDINGS.map(f => (
            <label key={f} className="flex items-center gap-3 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={selected.includes(f)}
                onChange={() => toggle(f)}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-sm text-gray-700">{f}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="card p-4 space-y-2">
        <label className="text-sm font-semibold text-gray-700">Additional Findings</label>
        <textarea
          value={additional}
          onChange={e => updateAdditional(e.target.value)}
          rows={3}
          placeholder="Any additional examination findings..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
    </div>
  );
}
