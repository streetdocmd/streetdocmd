"use client";
import { useState } from "react";

type VitalsData = {
  bp_systolic: string; bp_diastolic: string;
  pulse_rate: string; pulse_rhythm: string;
  temperature: string; temp_unit: string;
  spo2: string; respiratory_rate: string;
  weight: string; height: string;
};

function isFlagged(field: string, value: string, unit?: string): boolean {
  const n = parseFloat(value);
  if (isNaN(n)) return false;
  switch (field) {
    case "bp_systolic": return n > 140 || n < 90;
    case "bp_diastolic": return n > 90 || n < 60;
    case "pulse_rate": return n < 60 || n > 100;
    case "temperature":
      if (unit === "F") return n > 99.5 || n < 96.8;
      return n > 37.5 || n < 36.0;
    case "spo2": return n < 94;
    case "respiratory_rate": return n < 12 || n > 20;
  }
  return false;
}

function FlagIcon() {
  return <span className="text-red-500 ml-1" title="Outside normal range">⚠</span>;
}

function VitalInput({
  label, field, value, unit, onChange, placeholder, type = "number", min, max,
}: {
  label: string; field: string; value: string; unit?: string;
  onChange: (v: string) => void; placeholder?: string;
  type?: string; min?: number; max?: number;
}) {
  const flagged = isFlagged(field, value, unit);
  return (
    <div>
      <label className="text-sm text-gray-600">{label}</label>
      <div className="flex items-center mt-1">
        <input
          type={type}
          min={min} max={max}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${flagged ? "border-red-500 focus:ring-red-400" : "border-gray-200"}`}
        />
        {flagged && <FlagIcon />}
      </div>
      {flagged && <p className="text-xs text-red-500 mt-0.5">Outside normal range</p>}
    </div>
  );
}

export default function Step9Vitals({ value, onChange }: {
  value: Partial<VitalsData>;
  onChange: (v: Partial<VitalsData>) => void;
}) {
  const [data, setData] = useState<Partial<VitalsData>>(value ?? { temp_unit: "C", pulse_rhythm: "Regular" });

  const set = (field: keyof VitalsData, val: string) => {
    const next = { ...data, [field]: val };
    setData(next);
    onChange(next);
  };

  const bmi = (() => {
    const w = parseFloat(data.weight ?? "");
    const h = parseFloat(data.height ?? "");
    if (!w || !h) return null;
    return (w / Math.pow(h / 100, 2)).toFixed(1);
  })();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Step 9 — Vitals</h2>
        <p className="text-sm text-gray-500 mt-0.5">Blood pressure and pulse rate are required <span className="text-red-500">*</span></p>
      </div>

      {/* Blood Pressure */}
      <div className="card p-4 space-y-2">
        <p className="text-sm font-semibold text-gray-800">Blood Pressure</p>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <VitalInput label="Systolic (mmHg)" field="bp_systolic" value={data.bp_systolic ?? ""} onChange={v => set("bp_systolic", v)} placeholder="e.g. 120" />
          </div>
          <span className="text-2xl text-gray-300 mt-5 font-light">/</span>
          <div className="flex-1">
            <VitalInput label="Diastolic (mmHg)" field="bp_diastolic" value={data.bp_diastolic ?? ""} onChange={v => set("bp_diastolic", v)} placeholder="e.g. 80" />
          </div>
        </div>
      </div>

      {/* Pulse Rate */}
      <div className="card p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-800">Pulse Rate</p>
        <VitalInput label="Beats per minute" field="pulse_rate" value={data.pulse_rate ?? ""} onChange={v => set("pulse_rate", v)} placeholder="e.g. 72" />
        <div>
          <p className="text-xs text-gray-500 mb-1">Rhythm</p>
          <div className="flex gap-2">
            {["Regular", "Irregular"].map(r => (
              <button
                key={r}
                onClick={() => set("pulse_rhythm", r)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${data.pulse_rhythm === r ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >{r}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Temperature */}
      <div className="card p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-800">Temperature</p>
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <VitalInput label={`Degrees ${data.temp_unit ?? "C"}`} field="temperature" unit={data.temp_unit} value={data.temperature ?? ""} onChange={v => set("temperature", v)} placeholder={data.temp_unit === "F" ? "e.g. 98.6" : "e.g. 37.0"} />
          </div>
          <div className="mt-5">
            <div className="flex gap-1">
              {["C", "F"].map(u => (
                <button
                  key={u}
                  onClick={() => set("temp_unit", u)}
                  className={`w-10 h-10 rounded-lg text-sm font-bold border transition-colors ${data.temp_unit === u ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                >°{u}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SpO2 */}
      <div className="card p-4 space-y-2">
        <p className="text-sm font-semibold text-gray-800">Oxygen Saturation (SpO₂)</p>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <VitalInput label="%" field="spo2" value={data.spo2 ?? ""} onChange={v => set("spo2", v)} placeholder="e.g. 98" min={0} max={100} />
          </div>
          <span className="text-gray-400 text-sm mt-5">%</span>
        </div>
      </div>

      {/* Respiratory Rate */}
      <div className="card p-4 space-y-2">
        <p className="text-sm font-semibold text-gray-800">Respiratory Rate</p>
        <VitalInput label="Breaths per minute" field="respiratory_rate" value={data.respiratory_rate ?? ""} onChange={v => set("respiratory_rate", v)} placeholder="e.g. 16" />
      </div>

      {/* Weight & Height */}
      <div className="card p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-800">Weight & Height (Optional)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-600">Weight (kg)</label>
            <input
              type="number" min="0" step="0.1"
              value={data.weight ?? ""}
              onChange={e => set("weight", e.target.value)}
              placeholder="e.g. 70"
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Height (cm)</label>
            <input
              type="number" min="0" step="0.1"
              value={data.height ?? ""}
              onChange={e => set("height", e.target.value)}
              placeholder="e.g. 170"
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        {bmi && (
          <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm">
            <span className="font-semibold text-blue-800">BMI: {bmi}</span>
            <span className="text-blue-600 ml-2">
              {parseFloat(bmi) < 18.5 ? "Underweight" : parseFloat(bmi) < 25 ? "Normal weight" : parseFloat(bmi) < 30 ? "Overweight" : "Obese"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
