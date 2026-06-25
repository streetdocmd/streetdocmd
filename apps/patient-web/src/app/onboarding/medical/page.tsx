"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const RELATIONSHIPS = ["Spouse", "Parent", "Sibling", "Child", "Friend", "Other"];

function TagInput({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function add() {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) onChange([...values, trimmed]);
    setInput("");
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder={placeholder}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <button type="button" onClick={add}
          className="px-3 py-2 bg-blue-50 text-blue-brand border border-blue-200 rounded-xl text-sm font-medium hover:bg-blue-100">
          Add
        </button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {values.map(v => (
            <span key={v} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full">
              {v}
              <button type="button" onClick={() => onChange(values.filter(x => x !== v))}
                className="ml-0.5 text-blue-400 hover:text-blue-600 font-medium">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MedicalOnboardingPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [medications, setMedications] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [ecName, setEcName] = useState("");
  const [ecPhone, setEcPhone] = useState("");
  const [ecRelation, setEcRelation] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!gender) { setError("Please select your gender."); return; }
    setSaving(true);
    setError("");

    const res = await fetch("/api/profile/medical", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dob: dob || null,
        gender: gender || null,
        blood_group: bloodGroup || null,
        known_conditions: conditions,
        current_medications: medications,
        allergies,
        emergency_contact_name: ecName || null,
        emergency_contact_phone: ecPhone || null,
        emergency_contact_relationship: ecRelation || null,
      }),
    });

    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Failed to save");
      setSaving(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-700 to-navy-900 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-blue-brand rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="text-white font-bold text-xl">StreetdocMD</span>
          </div>
          <p className="text-blue-200 text-sm">Step 2 of 2 — Medical profile</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-xl">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Your medical profile</h1>
          <p className="text-gray-500 text-sm mb-6">
            This helps your doctor give you the best care. You can always update it from your profile.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Basic health info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Date of birth</label>
                <input type="date" className="input" value={dob} onChange={e => setDob(e.target.value)}
                  max={new Date().toISOString().split("T")[0]} required />
              </div>
              <div>
                <label className="label">Blood group</label>
                <select className="input" value={bloodGroup} onChange={e => setBloodGroup(e.target.value)}>
                  <option value="">Don&apos;t know</option>
                  {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Gender</label>
              <div className="flex gap-3 mt-1">
                {["male", "female", "other"].map(g => (
                  <label key={g} className={`flex-1 flex items-center justify-center gap-2 border rounded-xl py-2.5 cursor-pointer text-sm font-medium transition-colors ${
                    gender === g ? "border-blue-brand bg-blue-50 text-blue-brand" : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}>
                    <input type="radio" name="gender" value={g} checked={gender === g}
                      onChange={() => setGender(g)} className="sr-only" />
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            {/* Medical arrays */}
            <TagInput
              label="Known conditions"
              placeholder="e.g. Diabetes, Hypertension"
              values={conditions}
              onChange={setConditions}
            />
            <TagInput
              label="Current medications"
              placeholder="e.g. Metformin 500mg"
              values={medications}
              onChange={setMedications}
            />
            <TagInput
              label="Allergies"
              placeholder="e.g. Penicillin, Peanuts"
              values={allergies}
              onChange={setAllergies}
            />

            {/* Emergency contact */}
            <div className="pt-1 border-t">
              <p className="text-sm font-semibold text-gray-700 mb-3">Emergency contact</p>
              <div className="space-y-3">
                <div>
                  <label className="label">Full name</label>
                  <input className="input" placeholder="Ngozi Obi" value={ecName} onChange={e => setEcName(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Phone number</label>
                    <input type="tel" className="input" placeholder="08012345678" value={ecPhone} onChange={e => setEcPhone(e.target.value)} required />
                  </div>
                  <div>
                    <label className="label">Relationship</label>
                    <select className="input" value={ecRelation} onChange={e => setEcRelation(e.target.value)} required>
                      <option value="">Select</option>
                      {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <div className="pt-1">
              <button type="submit" disabled={saving} className="btn-primary w-full flex justify-center">
                {saving ? "Saving…" : "Save & go to dashboard"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}