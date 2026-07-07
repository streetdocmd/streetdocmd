"use client";
import { useState } from "react";

type Med = { name: string; dose: string; frequency: string; duration: string; status: "confirmed" | "discontinued" | "unchanged" };

export default function Step5CurrentMedications({ patient, value, onChange }: {
  patient: any;
  value: Med[] | null;
  onChange: (v: Med[]) => void;
}) {
  const existing: string[] = patient?.current_medications ?? [];
  const [meds, setMeds] = useState<Med[]>(
    value ?? existing.map(m => ({ name: m, dose: "", frequency: "", duration: "", status: "unchanged" }))
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", dose: "", frequency: "", duration: "" });

  const update = (next: Med[]) => { setMeds(next); onChange(next); };

  const setStatus = (i: number, status: Med["status"]) => {
    update(meds.map((m, idx) => idx === i ? { ...m, status } : m));
  };

  const addMed = () => {
    if (!form.name.trim()) return;
    update([...meds, { ...form, status: "confirmed" }]);
    setForm({ name: "", dose: "", frequency: "", duration: "" });
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Step 5 — Current Medications</h2>
        <p className="text-sm text-gray-500 mt-0.5">Review existing medications and add any new ones</p>
      </div>

      {meds.length > 0 ? (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Drug", "Dose", "Frequency", "Duration", "Actions"].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {meds.map((m, i) => (
                <tr key={i} className={m.status === "discontinued" ? "opacity-50" : ""}>
                  <td className="px-3 py-2 font-medium text-gray-800">{m.name}</td>
                  <td className="px-3 py-2 text-gray-600">{m.dose || "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{m.frequency || "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{m.duration || "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setStatus(i, "confirmed")}
                        className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${m.status === "confirmed" ? "bg-green-100 text-green-700 border border-green-200" : "bg-gray-100 text-gray-500 hover:bg-green-50"}`}
                      >✓ Confirm</button>
                      <button
                        onClick={() => setStatus(i, "discontinued")}
                        className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${m.status === "discontinued" ? "bg-red-100 text-red-700 border border-red-200" : "bg-gray-100 text-gray-500 hover:bg-red-50"}`}
                      >✗ D/C</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card p-4 text-center text-sm text-gray-400">No current medications on file</div>
      )}

      {showForm ? (
        <div className="card p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Add New Medication</p>
          <div className="grid grid-cols-2 gap-2">
            {(["name", "dose", "frequency", "duration"] as const).map(f => (
              <input
                key={f}
                type="text"
                value={form[f]}
                onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                placeholder={f.charAt(0).toUpperCase() + f.slice(1)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={addMed} className="btn-teal text-sm px-4 py-2">Add</button>
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="w-full border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors font-medium">
          + Add New Medication
        </button>
      )}
    </div>
  );
}
