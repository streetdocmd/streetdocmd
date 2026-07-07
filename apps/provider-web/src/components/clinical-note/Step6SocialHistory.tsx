"use client";
import { useState } from "react";

type SocialHistory = {
  smoking: string; pack_years?: string;
  alcohol: string; occupation: string;
  marital_status: string; living_situation: string;
};

export default function Step6SocialHistory({ value, onChange }: {
  value: Partial<SocialHistory> | null;
  onChange: (v: Partial<SocialHistory>) => void;
}) {
  const [data, setData] = useState<Partial<SocialHistory>>(value ?? {});

  const set = (field: keyof SocialHistory, val: string) => {
    const next = { ...data, [field]: val };
    setData(next);
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Step 6 — Social History</h2>
      </div>

      <div className="card p-4 space-y-4">
        <RadioGroup label="Smoking Status" value={data.smoking ?? ""} onChange={v => set("smoking", v)}
          options={["Never", "Ex-smoker", "Current smoker"]} />
        {data.smoking === "Current smoker" && (
          <div>
            <label className="text-sm text-gray-600">Pack-years</label>
            <input type="number" min="0" value={data.pack_years ?? ""} onChange={e => set("pack_years", e.target.value)}
              className="mt-1 w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}

        <RadioGroup label="Alcohol Use" value={data.alcohol ?? ""} onChange={v => set("alcohol", v)}
          options={["Never", "Social", "Regular"]} />

        <div>
          <label className="text-sm font-semibold text-gray-700">Occupation</label>
          <input type="text" value={data.occupation ?? ""} onChange={e => set("occupation", e.target.value)}
            placeholder="e.g. Teacher, Nurse..."
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700">Marital Status</label>
          <select value={data.marital_status ?? ""} onChange={e => set("marital_status", e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">Select...</option>
            {["Single", "Married", "Widowed", "Divorced", "Separated"].map(o => <option key={o}>{o}</option>)}
          </select>
        </div>

        <RadioGroup label="Living Situation" value={data.living_situation ?? ""} onChange={v => set("living_situation", v)}
          options={["Alone", "With Family", "With Caregiver"]} />
      </div>
    </div>
  );
}

function RadioGroup({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name={label} checked={value === opt} onChange={() => onChange(opt)} className="accent-blue-600" />
            <span className="text-sm text-gray-700">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
