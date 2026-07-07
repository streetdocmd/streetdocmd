"use client";
import { useState } from "react";

export default function Step3ChronicIssues({ patient, value, onChange }: {
  patient: any;
  value: any;
  onChange: (v: any) => void;
}) {
  const existing: string[] = patient?.known_conditions ?? [];
  const [confirmed, setConfirmed] = useState<string[]>(value?.confirmed ?? []);
  const [added, setAdded] = useState<string[]>(value?.added ?? []);
  const [newCondition, setNewCondition] = useState("");
  const [showInput, setShowInput] = useState(false);

  const emit = (c: string[], a: string[]) => onChange({ confirmed: c, added: a });

  const toggleConfirm = (cond: string) => {
    const next = confirmed.includes(cond) ? confirmed.filter(x => x !== cond) : [...confirmed, cond];
    setConfirmed(next);
    emit(next, added);
  };

  const addNew = () => {
    const trimmed = newCondition.trim();
    if (!trimmed) return;
    const next = [...added, trimmed];
    setAdded(next);
    setNewCondition("");
    setShowInput(false);
    emit(confirmed, next);
  };

  const removeAdded = (cond: string) => {
    const next = added.filter(x => x !== cond);
    setAdded(next);
    emit(confirmed, next);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Step 3 — Chronic Issues</h2>
        <p className="text-sm text-gray-500 mt-0.5">Confirm existing conditions and add any new ones</p>
      </div>

      {existing.length > 0 ? (
        <div className="card p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Known Conditions (from patient profile)</p>
          {existing.map(cond => (
            <label key={cond} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed.includes(cond)}
                onChange={() => toggleConfirm(cond)}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-sm text-gray-700">{cond}</span>
              {confirmed.includes(cond) && <span className="text-xs text-green-600 font-medium">✓ Confirmed</span>}
            </label>
          ))}
        </div>
      ) : (
        <div className="card p-4 text-center text-sm text-gray-400">No known conditions on file</div>
      )}

      {added.length > 0 && (
        <div className="card p-4 space-y-2">
          <p className="text-sm font-semibold text-gray-700">Newly Added Conditions</p>
          {added.map(cond => (
            <div key={cond} className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
              <span className="text-sm text-blue-800">{cond}</span>
              <button onClick={() => removeAdded(cond)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
            </div>
          ))}
        </div>
      )}

      {showInput ? (
        <div className="card p-4 space-y-2">
          <input
            type="text"
            value={newCondition}
            onChange={e => setNewCondition(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addNew()}
            placeholder="Type new chronic condition..."
            autoFocus
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button onClick={addNew} className="btn-teal text-sm px-4 py-2">Add</button>
            <button onClick={() => setShowInput(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowInput(true)} className="w-full border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors font-medium">
          + Add New Chronic Condition
        </button>
      )}
    </div>
  );
}
