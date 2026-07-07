"use client";
import { useState } from "react";

type Interventions = Record<string, any>;

const STANDARD = [
  { key: "history_taken", label: "History taken and documented" },
  { key: "physical_exam", label: "Physical examination performed" },
  { key: "bp_measured", label: "Blood pressure measured" },
  { key: "glucose_measured", label: "Blood glucose measured" },
  { key: "malaria_rdt", label: "Malaria RDT performed", resultKey: "malaria_result" },
  { key: "typhoid_test", label: "Typhoid test performed", resultKey: "typhoid_result" },
  { key: "wound_dressing", label: "Wound dressing performed" },
  { key: "injection", label: "Injection administered", specKey: "injection_spec", specLabel: "Specify injection:" },
  { key: "iv_cannula", label: "IV cannula inserted" },
  { key: "iv_fluids", label: "IV fluids administered", specKey: "iv_fluids_spec", specLabel: "Specify type and volume:" },
  { key: "meds_dispensed", label: "Medications dispensed on site", specKey: "meds_dispensed_spec", specLabel: "Specify medications:" },
  { key: "patient_education", label: "Patient education provided" },
  { key: "caregiver_education", label: "Caregiver education provided" },
];

export default function Step12Interventions({ value, onChange }: {
  value: Interventions | null;
  onChange: (v: Interventions) => void;
}) {
  const [data, setData] = useState<Interventions>(value ?? {});

  const set = (k: string, v: any) => {
    const next = { ...data, [k]: v };
    setData(next);
    onChange(next);
  };

  const toggle = (key: string) => set(key, !data[key]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Step 12 — Interventions</h2>
        <p className="text-sm text-gray-500 mt-0.5">What was done during this visit — select all that apply</p>
      </div>

      <div className="card p-4 space-y-3">
        {STANDARD.map(({ key, label, resultKey, specKey, specLabel }) => (
          <div key={key}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={!!data[key]} onChange={() => toggle(key)} className="w-4 h-4 accent-blue-600" />
              <span className="text-sm text-gray-700">{label}</span>
            </label>

            {data[key] && resultKey && (
              <div className="ml-7 mt-2 flex gap-4">
                <span className="text-xs text-gray-500 self-center">Result:</span>
                {["Positive", "Negative"].map(r => (
                  <label key={r} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name={resultKey} checked={data[resultKey] === r} onChange={() => set(resultKey, r)} className="accent-blue-600" />
                    <span className="text-sm text-gray-700">{r}</span>
                  </label>
                ))}
              </div>
            )}

            {data[key] && specKey && (
              <div className="ml-7 mt-2">
                <input
                  type="text"
                  value={data[specKey] ?? ""}
                  onChange={e => set(specKey, e.target.value)}
                  placeholder={specLabel}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card p-4 space-y-2">
        <label className="text-sm font-semibold text-gray-700">Additional Interventions</label>
        <textarea
          value={data.additional ?? ""}
          onChange={e => set("additional", e.target.value)}
          rows={3}
          placeholder="Any other interventions not listed above..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
    </div>
  );
}
