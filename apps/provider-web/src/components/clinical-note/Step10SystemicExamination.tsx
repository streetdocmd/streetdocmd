"use client";
import { useState } from "react";

type SystemName = "cardiovascular" | "respiratory" | "gastrointestinal" | "neurological" | "musculoskeletal" | "dermatological" | "ent" | "eyes";

const SYSTEMS: { key: SystemName; label: string; icon: string }[] = [
  { key: "cardiovascular", label: "Cardiovascular", icon: "🫀" },
  { key: "respiratory", label: "Respiratory", icon: "🫁" },
  { key: "gastrointestinal", label: "Gastrointestinal", icon: "🔵" },
  { key: "neurological", label: "Neurological", icon: "🧠" },
  { key: "musculoskeletal", label: "Musculoskeletal", icon: "🦴" },
  { key: "dermatological", label: "Dermatological", icon: "🩹" },
  { key: "ent", label: "ENT", icon: "👂" },
  { key: "eyes", label: "Eyes", icon: "👁️" },
];

function Radio({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-3">
        {options.map(o => (
          <label key={o} className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" checked={value === o} onChange={() => onChange(o)} className="accent-blue-600" />
            <span className="text-sm text-gray-700">{o}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={2} placeholder="Additional findings..."
        className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
    </div>
  );
}

function SystemForm({ sysKey, data, onChange }: { sysKey: SystemName; data: Record<string, any>; onChange: (d: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...data, [k]: v });
  const g = (k: string, def = "") => data[k] ?? def;

  switch (sysKey) {
    case "cardiovascular": return (
      <div className="space-y-4 pt-3">
        <Radio label="Heart Sounds" value={g("heart_sounds")} onChange={v => set("heart_sounds", v)} options={["Normal S1 S2", "Added sounds present"]} />
        <Radio label="Murmurs" value={g("murmurs")} onChange={v => set("murmurs", v)} options={["None", "Present"]} />
        {g("murmurs") === "Present" && <textarea value={g("murmur_description")} onChange={e => set("murmur_description", e.target.value)} placeholder="Describe murmur..." rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />}
        <Radio label="JVP" value={g("jvp")} onChange={v => set("jvp", v)} options={["Not raised", "Raised"]} />
        <Radio label="Peripheral Pulses" value={g("peripheral_pulses")} onChange={v => set("peripheral_pulses", v)} options={["Present and equal", "Reduced", "Absent"]} />
        <Textarea label="Additional Findings" value={g("additional")} onChange={v => set("additional", v)} />
      </div>
    );
    case "respiratory": return (
      <div className="space-y-4 pt-3">
        <Radio label="Air Entry" value={g("air_entry")} onChange={v => set("air_entry", v)} options={["Equal bilaterally", "Reduced left", "Reduced right", "Absent"]} />
        <Radio label="Breath Sounds" value={g("breath_sounds")} onChange={v => set("breath_sounds", v)} options={["Vesicular", "Bronchial", "Absent"]} />
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Added Sounds</p>
          <div className="flex flex-wrap gap-3">
            {["None", "Crepitations", "Wheeze", "Rhonchi", "Pleural rub"].map(o => (
              <label key={o} className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={(g("added_sounds", []) as string[]).includes(o)}
                  onChange={() => { const arr: string[] = g("added_sounds", []); set("added_sounds", arr.includes(o) ? arr.filter(x => x !== o) : [...arr, o]); }}
                  className="accent-blue-600" />
                <span className="text-sm text-gray-700">{o}</span>
              </label>
            ))}
          </div>
        </div>
        <Textarea label="Additional Findings" value={g("additional")} onChange={v => set("additional", v)} />
      </div>
    );
    case "gastrointestinal": return (
      <div className="space-y-4 pt-3">
        <Radio label="Abdomen" value={g("abdomen")} onChange={v => set("abdomen", v)} options={["Soft", "Rigid", "Distended", "Scaphoid"]} />
        <Radio label="Tenderness" value={g("tenderness")} onChange={v => set("tenderness", v)} options={["None", "Present"]} />
        {g("tenderness") === "Present" && <input type="text" value={g("tenderness_location")} onChange={e => set("tenderness_location", e.target.value)} placeholder="Location of tenderness..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />}
        <Radio label="Organomegaly" value={g("organomegaly")} onChange={v => set("organomegaly", v)} options={["None", "Hepatomegaly", "Splenomegaly", "Both"]} />
        <Radio label="Bowel Sounds" value={g("bowel_sounds")} onChange={v => set("bowel_sounds", v)} options={["Present", "Reduced", "Absent", "Hyperactive"]} />
        <Textarea label="Additional Findings" value={g("additional")} onChange={v => set("additional", v)} />
      </div>
    );
    case "neurological": return (
      <div className="space-y-4 pt-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">GCS (3–15)</label>
          <input type="number" min={3} max={15} value={g("gcs")} onChange={e => set("gcs", e.target.value)} className="mt-1 w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Orientation</p>
          <div className="space-y-1">
            {["Oriented to time", "Oriented to place", "Oriented to person"].map(o => (
              <label key={o} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={(g("orientation", []) as string[]).includes(o)}
                  onChange={() => { const arr: string[] = g("orientation", []); set("orientation", arr.includes(o) ? arr.filter(x => x !== o) : [...arr, o]); }}
                  className="accent-blue-600" />
                <span className="text-sm text-gray-700">{o}</span>
              </label>
            ))}
          </div>
        </div>
        <Radio label="Motor" value={g("motor")} onChange={v => set("motor", v)} options={["Normal", "Weakness"]} />
        {g("motor") === "Weakness" && <textarea value={g("motor_weakness_detail")} onChange={e => set("motor_weakness_detail", e.target.value)} placeholder="Specify weakness..." rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />}
        <Radio label="Reflexes" value={g("reflexes")} onChange={v => set("reflexes", v)} options={["Normal", "Hyperreflexia", "Hyporeflexia", "Absent"]} />
        <Textarea label="Additional Findings" value={g("additional")} onChange={v => set("additional", v)} />
      </div>
    );
    case "musculoskeletal": return (
      <div className="space-y-4 pt-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Affected Area</label>
          <input type="text" value={g("affected_area")} onChange={e => set("affected_area", e.target.value)} placeholder="Specify joint or region..." className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <Radio label="Swelling" value={g("swelling")} onChange={v => set("swelling", v)} options={["Present", "Absent"]} />
        <Radio label="Tenderness" value={g("tenderness")} onChange={v => set("tenderness", v)} options={["Present", "Absent"]} />
        <Radio label="Range of Motion" value={g("rom")} onChange={v => set("rom", v)} options={["Full", "Limited", "Absent"]} />
        <Textarea label="Additional Findings" value={g("additional")} onChange={v => set("additional", v)} />
      </div>
    );
    case "dermatological": return (
      <div className="space-y-4 pt-3">
        <Textarea label="Skin Findings Description" value={g("description")} onChange={v => set("description", v)} />
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Photo Upload (max 3, provider/admin only)</p>
          <input type="file" accept="image/*" multiple className="text-sm text-gray-600" />
          <p className="text-xs text-gray-400 mt-1">Photos are accessible to provider and admin only</p>
        </div>
      </div>
    );
    case "ent": return (
      <div className="space-y-4 pt-3">
        <Radio label="Throat" value={g("throat")} onChange={v => set("throat", v)} options={["Normal", "Erythematous", "Tonsillar enlargement", "Exudate"]} />
        <Radio label="Ears" value={g("ears")} onChange={v => set("ears", v)} options={["Normal", "Discharge", "Tenderness", "Wax impaction"]} />
        <Radio label="Nose" value={g("nose")} onChange={v => set("nose", v)} options={["Normal", "Congested", "Discharge", "Deviated septum"]} />
        <Textarea label="Additional Findings" value={g("additional")} onChange={v => set("additional", v)} />
      </div>
    );
    case "eyes": return (
      <div className="space-y-4 pt-3">
        <Radio label="Conjunctiva" value={g("conjunctiva")} onChange={v => set("conjunctiva", v)} options={["Pink", "Pale", "Injected", "Jaundiced"]} />
        <Radio label="Pupils" value={g("pupils")} onChange={v => set("pupils", v)} options={["Equal and reactive", "Unequal", "Sluggish", "Fixed"]} />
        <Textarea label="Additional Findings" value={g("additional")} onChange={v => set("additional", v)} />
      </div>
    );
  }
}

export default function Step10SystemicExamination({ value, onChange }: {
  value: Partial<Record<SystemName, Record<string, any>>> | null;
  onChange: (v: Partial<Record<SystemName, Record<string, any>>>) => void;
}) {
  const [selected, setSelected] = useState<Set<SystemName>>(new Set());
  const [data, setData] = useState<Partial<Record<SystemName, Record<string, any>>>>(value ?? {});

  const toggleSystem = (key: SystemName) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
  };

  const updateSystem = (key: SystemName, d: Record<string, any>) => {
    const next = { ...data, [key]: d };
    setData(next);
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Step 10 — Systemic Examination</h2>
        <p className="text-sm text-gray-500 mt-0.5">Select systems examined — multiple can be open simultaneously</p>
      </div>

      {/* System selector grid */}
      <div className="grid grid-cols-4 gap-2">
        {SYSTEMS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => toggleSystem(key)}
            className={`flex flex-col items-center p-2 rounded-xl border text-center transition-colors ${selected.has(key) ? "bg-blue-50 border-blue-400 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            <span className="text-xl">{icon}</span>
            <span className="text-[10px] font-medium mt-0.5 leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {/* Expanded system forms */}
      {SYSTEMS.filter(s => selected.has(s.key)).map(({ key, label, icon }) => (
        <div key={key} className="card overflow-hidden">
          <button
            onClick={() => toggleSystem(key)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span>{icon}</span>
              <span className="font-semibold text-gray-800">{label}</span>
              <span className="badge bg-blue-100 text-blue-700 text-xs">Active</span>
            </div>
            <span className="text-gray-400">▲</span>
          </button>
          <div className="px-4 pb-4">
            <SystemForm sysKey={key} data={data[key] ?? {}} onChange={d => updateSystem(key, d)} />
          </div>
        </div>
      ))}

      {selected.size === 0 && (
        <div className="text-center py-6 text-sm text-gray-400">
          Tap a system above to add examination findings
        </div>
      )}
    </div>
  );
}
