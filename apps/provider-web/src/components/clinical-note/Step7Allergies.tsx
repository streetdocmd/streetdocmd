"use client";
import { useState } from "react";

const REACTIONS = ["Rash", "Swelling", "Anaphylaxis", "GI Upset", "Other"];

type Allergy = { allergen: string; reaction: string; status: "confirmed" | "removed" };

export default function Step7Allergies({ patient, value, onChange }: {
  patient: any;
  value: Allergy[] | null;
  onChange: (v: Allergy[]) => void;
}) {
  const existing: string[] = patient?.allergies ?? [];
  const [allergies, setAllergies] = useState<Allergy[]>(
    value ?? existing.map(a => ({ allergen: a, reaction: "", status: "confirmed" as const }))
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ allergen: "", reaction: "Rash" });

  const update = (next: Allergy[]) => { setAllergies(next); onChange(next); };

  const setReaction = (i: number, reaction: string) => update(allergies.map((a, idx) => idx === i ? { ...a, reaction } : a));
  const setStatus = (i: number, status: Allergy["status"]) => update(allergies.map((a, idx) => idx === i ? { ...a, status } : a));

  const addAllergy = () => {
    if (!form.allergen.trim()) return;
    update([...allergies, { ...form, status: "confirmed" }]);
    setForm({ allergen: "", reaction: "Rash" });
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Step 7 — Allergies</h2>
        <p className="text-sm text-gray-500 mt-0.5">Verify known allergies and add new ones</p>
      </div>

      {allergies.length > 0 ? (
        <div className="card p-4 space-y-3">
          {allergies.map((a, i) => (
            <div key={i} className={`flex items-center gap-3 py-2 border-b border-gray-100 last:border-0 ${a.status === "removed" ? "opacity-40" : ""}`}>
              <span className="text-sm font-medium text-gray-800 flex-1">{a.allergen}</span>
              <select
                value={a.reaction}
                onChange={e => setReaction(i, e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Reaction type...</option>
                {REACTIONS.map(r => <option key={r}>{r}</option>)}
              </select>
              <button
                onClick={() => setStatus(i, a.status === "removed" ? "confirmed" : "removed")}
                className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${a.status === "removed" ? "bg-gray-100 text-gray-500" : "bg-red-100 text-red-600 hover:bg-red-200"}`}
              >{a.status === "removed" ? "Restore" : "✕ Remove"}</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-4 text-center text-sm text-gray-400">No allergies on file</div>
      )}

      {showForm ? (
        <div className="card p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Add New Allergy</p>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={form.allergen} onChange={e => setForm(p => ({ ...p, allergen: e.target.value }))}
              placeholder="Allergen name" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <select value={form.reaction} onChange={e => setForm(p => ({ ...p, reaction: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {REACTIONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={addAllergy} className="btn-teal text-sm px-4 py-2">Add</button>
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="w-full border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors font-medium">
          + Add New Allergy
        </button>
      )}
    </div>
  );
}
