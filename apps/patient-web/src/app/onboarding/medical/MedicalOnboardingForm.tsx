"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { normalizePhone, PHONE_ERROR } from "@/lib/phone";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const RELATIONSHIPS = ["Spouse", "Parent", "Sibling", "Child", "Friend", "Other"];

type Initial = {
  dob: string | null;
  gender: string | null;
  blood_group: string | null;
  known_conditions: string[] | null;
  current_medications: string[] | null;
  allergies: string[] | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
};

function TagInput({
  label,
  placeholder,
  values,
  onChange,
  pendingRef,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (v: string[]) => void;
  pendingRef: React.MutableRefObject<string>;
}) {
  const [input, setInput] = useState("");

  function add() {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) onChange([...values, trimmed]);
    setInput("");
    // pendingRef is intentionally left as-is: if Save is clicked straight
    // from this box, the blur-triggered add may not have re-rendered yet,
    // and withPending() dedupes it either way.
  }

  return (
    <div>
      <label className="label">{label} <span className="font-normal text-gray-400">(optional)</span></label>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder={placeholder}
          value={input}
          onChange={e => { setInput(e.target.value); pendingRef.current = e.target.value; }}
          onBlur={add}
          onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
        />
        <button type="button" onClick={add}
          className="px-3 py-2 bg-blue-light text-blue-brand border border-blue-mid rounded-lg text-sm font-medium hover:bg-blue-100">
          Add
        </button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {values.map(v => (
            <span key={v} className="inline-flex items-center gap-1 bg-blue-light text-blue-700 text-xs px-2.5 py-1 rounded-full">
              {v}
              <button type="button" aria-label={`Remove ${v}`} onClick={() => { pendingRef.current = ""; onChange(values.filter(x => x !== v)); }}
                className="ml-0.5 text-blue-400 hover:text-blue-600 font-medium">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Folds anything typed into a tag box but not yet "Added" into the list,
// so pressing Save never silently drops it.
function withPending(values: string[], pending: string) {
  const t = pending.trim();
  return t && !values.includes(t) ? [...values, t] : values;
}

export default function MedicalOnboardingForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [dob, setDob] = useState(initial.dob ?? "");
  const [gender, setGender] = useState(initial.gender ?? "");
  const [bloodGroup, setBloodGroup] = useState(initial.blood_group ?? "");
  const [conditions, setConditions] = useState<string[]>(initial.known_conditions ?? []);
  const [medications, setMedications] = useState<string[]>(initial.current_medications ?? []);
  const [allergies, setAllergies] = useState<string[]>(initial.allergies ?? []);
  const [ecName, setEcName] = useState(initial.emergency_contact_name ?? "");
  const [ecPhone, setEcPhone] = useState(initial.emergency_contact_phone ?? "");
  const [ecRelation, setEcRelation] = useState(initial.emergency_contact_relationship ?? "");

  const pendingConditions = useRef("");
  const pendingMedications = useRef("");
  const pendingAllergies = useRef("");

  const today = new Date().toISOString().split("T")[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!dob) { setError("Please enter your date of birth."); return; }
    if (dob > today || dob < "1900-01-01") { setError("Please enter a valid date of birth."); return; }
    if (!gender) { setError("Please select your gender."); return; }
    if (!ecName.trim()) { setError("Please add an emergency contact name."); return; }
    const ecPhoneNorm = normalizePhone(ecPhone);
    if (!ecPhoneNorm) { setError(`Emergency contact: ${PHONE_ERROR}`); return; }
    if (!ecRelation) { setError("Please select your emergency contact's relationship to you."); return; }
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/profile/medical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dob,
          gender,
          blood_group: bloodGroup || null,
          known_conditions: withPending(conditions, pendingConditions.current),
          current_medications: withPending(medications, pendingMedications.current),
          allergies: withPending(allergies, pendingAllergies.current),
          emergency_contact_name: ecName.trim(),
          emergency_contact_phone: ecPhoneNorm,
          emergency_contact_relationship: ecRelation,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        if (res.status === 401) { router.push("/login"); return; }
        setError(json.error ?? "We couldn't save your profile. Please try again.");
        setSaving(false);
        return;
      }

      router.push("/dashboard?welcome=1");
      router.refresh();
    } catch {
      setError("Couldn't reach StreetdocMD. Check your internet connection and try again.");
      setSaving(false);
    }
  }

  return (
    <AuthShell subtitle="Step 2 of 2 · Medical profile" maxWidth="max-w-xl">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Your medical profile</h1>
      <p className="text-gray-500 text-sm mb-6">
        This helps the clinician who visits you give you safe, informed care. You can update it anytime from your profile.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="dob">Date of birth</label>
            <input id="dob" type="date" className="input" value={dob} onChange={e => setDob(e.target.value)}
              min="1900-01-01" max={today} />
          </div>
          <div>
            <label className="label" htmlFor="blood">Blood group <span className="font-normal text-gray-400">(optional)</span></label>
            <select id="blood" className="input" value={bloodGroup} onChange={e => setBloodGroup(e.target.value)}>
              <option value="">Don&apos;t know</option>
              {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
            </select>
          </div>
        </div>

        <div>
          <span className="label">Gender</span>
          <div className="flex gap-3 mt-1">
            {["male", "female", "other"].map(g => (
              <label key={g} className={`flex-1 flex items-center justify-center gap-2 border rounded-lg py-2.5 cursor-pointer text-sm font-medium transition-colors ${
                gender === g ? "border-blue-brand bg-blue-light text-blue-brand" : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}>
                <input type="radio" name="gender" value={g} checked={gender === g}
                  onChange={() => setGender(g)} className="sr-only" />
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <TagInput label="Known conditions" placeholder="e.g. Diabetes, Hypertension"
          values={conditions} onChange={setConditions} pendingRef={pendingConditions} />
        <TagInput label="Current medications" placeholder="e.g. Metformin 500mg"
          values={medications} onChange={setMedications} pendingRef={pendingMedications} />
        <TagInput label="Allergies" placeholder="e.g. Penicillin, Peanuts"
          values={allergies} onChange={setAllergies} pendingRef={pendingAllergies} />

        <div className="pt-4 border-t border-gray-100">
          <p className="text-sm font-semibold text-gray-900">Emergency contact</p>
          <p className="text-xs text-gray-500 mb-3">Someone we can reach if anything goes wrong during a visit.</p>
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="ecName">Full name</label>
              <input id="ecName" className="input" placeholder="Ngozi Obi" value={ecName} onChange={e => setEcName(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="ecPhone">Phone number</label>
                <input id="ecPhone" type="tel" inputMode="tel" className="input" placeholder="08012345678" value={ecPhone} onChange={e => setEcPhone(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="ecRel">Relationship</label>
                <select id="ecRel" className="input" value={ecRelation} onChange={e => setEcRelation(e.target.value)}>
                  <option value="">Select</option>
                  {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                  {ecRelation && !RELATIONSHIPS.includes(ecRelation) && <option value={ecRelation}>{ecRelation}</option>}
                </select>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="pt-1 space-y-3">
          <button type="submit" disabled={saving} className="btn-primary w-full flex justify-center">
            {saving ? "Saving…" : "Save & go to dashboard"}
          </button>
          <Link href="/dashboard" className="block text-center text-sm font-medium text-gray-500 hover:text-gray-700">
            Skip for now
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
