"use client";
import { useState } from "react";

type HistoryFields = {
  presenting_complaint_history: string;
  past_medical: string;
  surgical: string;
  family: string;
  obstetric_gynaecological: string;
  review_of_systems: string;
};

export default function Step4History({ patient, value, onChange }: {
  patient: any;
  value: Partial<HistoryFields> | null;
  onChange: (v: Partial<HistoryFields>) => void;
}) {
  const [data, setData] = useState<Partial<HistoryFields>>(value ?? {});

  const update = (field: keyof HistoryFields, val: string) => {
    const next = { ...data, [field]: val };
    setData(next);
    onChange(next);
  };

  const isFemal = (patient?.gender ?? "").toLowerCase().startsWith("f");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Step 4 — History</h2>
        <p className="text-sm text-gray-500 mt-0.5">All fields optional — auto-saved</p>
      </div>

      <HistoryField label="History of Presenting Complaint" value={data.presenting_complaint_history ?? ""} onChange={v => update("presenting_complaint_history", v)} />
      <HistoryField label="Past Medical History" value={data.past_medical ?? ""} onChange={v => update("past_medical", v)} />
      <HistoryField label="Surgical History" value={data.surgical ?? ""} onChange={v => update("surgical", v)} />
      <HistoryField label="Family History" value={data.family ?? ""} onChange={v => update("family", v)} />
      {isFemal && (
        <HistoryField label="Obstetric / Gynaecological History" value={data.obstetric_gynaecological ?? ""} onChange={v => update("obstetric_gynaecological", v)} />
      )}
      <HistoryField label="Review of Systems" value={data.review_of_systems ?? ""} onChange={v => update("review_of_systems", v)} />
    </div>
  );
}

function HistoryField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="card p-4 space-y-2">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
        placeholder="Enter notes here..."
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
    </div>
  );
}
