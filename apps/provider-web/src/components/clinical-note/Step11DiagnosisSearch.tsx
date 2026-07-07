"use client";
import { useState } from "react";
import DiagnosisSearchWidget, { type DiagnosisEntry } from "./DiagnosisSearchWidget";

export default function Step11DiagnosisSearch({ noteId, providerId, patientId, value, onChange }: {
  noteId: string;
  providerId: string;
  patientId?: string;
  value: DiagnosisEntry[];
  onChange: (v: DiagnosisEntry[]) => void;
}) {
  const [diagnoses, setDiagnoses] = useState<(DiagnosisEntry | null)[]>(value.length > 0 ? value : [null]);

  const update = (i: number, d: DiagnosisEntry) => {
    const next = [...diagnoses];
    next[i] = d;
    setDiagnoses(next);
    onChange(next.filter(Boolean) as DiagnosisEntry[]);
  };

  const add = () => {
    if (diagnoses.length < 5) setDiagnoses([...diagnoses, null]);
  };

  const remove = (i: number) => {
    const next = diagnoses.filter((_, idx) => idx !== i);
    setDiagnoses(next.length === 0 ? [null] : next);
    onChange((next.length === 0 ? [] : next.filter(Boolean)) as DiagnosisEntry[]);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Step 11 — Diagnosis</h2>
        <p className="text-sm text-gray-500 mt-0.5">Impression / Assessment / Diagnosis <span className="text-red-500">*Required</span></p>
      </div>

      <div className="space-y-3">
        {diagnoses.map((d, i) => (
          <div key={i} className="card p-4">
            <DiagnosisSearchWidget
              index={i}
              providerId={providerId}
              value={d}
              onChange={v => update(i, v)}
              onRemove={i > 0 ? () => remove(i) : undefined}
            />
          </div>
        ))}
      </div>

      {diagnoses.length < 5 && (
        <button onClick={add} className="w-full border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors font-medium">
          + Add Another Diagnosis
        </button>
      )}
    </div>
  );
}
