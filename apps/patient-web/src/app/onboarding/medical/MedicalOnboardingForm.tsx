"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, X } from "lucide-react";
import {
  Button, Chip, Input, Notice, SegmentedControl, TopBar, cx, fieldLabelClass, focusRing, inputClass,
} from "@/components/ds";
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

// Common answers shown as tap chips; anything else is typed into the box below them.
const ALLERGY_CHIPS = ["Penicillin", "Sulfa drugs", "Latex", "Nuts"];
const CONDITION_CHIPS = ["Diabetes", "Hypertension", "Asthma", "Heart condition", "Pregnancy"];

const optional = <span className="font-normal text-muted">(optional)</span>;

function TagInput({
  label,
  placeholder,
  values,
  onChange,
  pendingRef,
  presets = [],
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (v: string[]) => void;
  pendingRef: React.MutableRefObject<string>;
  /** Tap chips for common answers. "None" clears the list (it is never stored). */
  presets?: string[];
}) {
  const [input, setInput] = useState("");
  const [saidNone, setSaidNone] = useState(false);
  const inputId = useId();

  function add() {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) { onChange([...values, trimmed]); setSaidNone(false); }
    setInput("");
    // pendingRef is intentionally left as-is: if Save is clicked straight
    // from this box, the blur-triggered add may not have re-rendered yet,
    // and withPending() dedupes it either way.
  }

  function toggle(v: string) {
    setSaidNone(false);
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);
  }

  const custom = values.filter(v => !presets.includes(v));

  return (
    <div>
      <label htmlFor={inputId} className={fieldLabelClass}>{label} {optional}</label>
      <div className="flex flex-wrap gap-2">
        {presets.length > 0 && (
          <Chip multi selected={saidNone && values.length === 0} onClick={() => { setSaidNone(true); pendingRef.current = ""; onChange([]); }}>
            None
          </Chip>
        )}
        {presets.map(p => (
          <Chip key={p} multi selected={values.includes(p)} onClick={() => toggle(p)}>{p}</Chip>
        ))}
        {custom.map(v => (
          <Chip key={v} multi selected aria-label={`Remove ${v}`}
            onClick={() => { pendingRef.current = ""; onChange(values.filter(x => x !== v)); }}>
            {v} <X size={14} aria-hidden />
          </Chip>
        ))}
      </div>
      <div className={`flex gap-2 ${presets.length > 0 || custom.length > 0 ? "mt-2.5" : ""}`}>
        <input
          id={inputId}
          className={inputClass(false, "flex-1")}
          placeholder={placeholder}
          value={input}
          onChange={e => { setInput(e.target.value); pendingRef.current = e.target.value; }}
          onBlur={add}
          onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
        />
        <Button variant="secondary" size="lg" onClick={add}>Add</Button>
      </div>
    </div>
  );
}

// Native select styled like the other fields, with its own chevron
function SelectField({ id, label, value, onChange, children }: {
  id: string;
  label: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={fieldLabelClass} htmlFor={id}>{label}</label>
      <div className="relative">
        <select id={id} className={inputClass(false, "appearance-none pr-10")} value={value} onChange={e => onChange(e.target.value)}>
          {children}
        </select>
        <ChevronDown size={18} aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted" />
      </div>
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
    <main className="min-h-[100dvh] bg-page">
      <div className="mx-auto max-w-md pb-8">
        {/* Sign up is step 1; this skippable profile is step 2 */}
        <TopBar
          title="Step 2 of 2"
          hideBack
          className="pt-4"
          right={
            <Link href="/dashboard" className={cx("w-11 text-right text-[13px] font-bold text-accent rounded-sm", focusRing)}>
              Skip
            </Link>
          }
        />
        <div className="flex gap-1.5 px-5 pb-3.5" aria-hidden>
          <span className="h-[5px] flex-1 rounded bg-accent" />
          <span className="h-[5px] flex-1 rounded bg-accent" />
        </div>

        <div className="px-5">
          <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy">Make every visit safer</h1>
          <p className="mt-1.5 mb-5 text-ds-sm text-muted">
            Providers read this before they arrive. You can change it at any time.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input id="dob" label="Date of birth" type="date" value={dob} onChange={e => setDob(e.target.value)}
              min="1900-01-01" max={today} />

            <div>
              <span className={fieldLabelClass} aria-hidden>Gender</span>
              <SegmentedControl
                label="Gender"
                value={gender}
                onChange={setGender}
                options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }]}
              />
            </div>

            <TagInput label="Allergies" placeholder="Add another allergy"
              values={allergies} onChange={setAllergies} pendingRef={pendingAllergies} presets={ALLERGY_CHIPS} />
            <TagInput label="Long term conditions" placeholder="Add another condition"
              values={conditions} onChange={setConditions} pendingRef={pendingConditions} presets={CONDITION_CHIPS} />
            <TagInput label="Current medications" placeholder="e.g. Metformin 500mg"
              values={medications} onChange={setMedications} pendingRef={pendingMedications} />

            <SelectField id="blood" label={<>Blood group {optional}</>} value={bloodGroup} onChange={setBloodGroup}>
              <option value="">Don&apos;t know</option>
              {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
            </SelectField>

            <fieldset className="space-y-3 border-t border-line pt-4">
              <legend className="sr-only">Emergency contact</legend>
              <div>
                <p className="text-ds-sm font-semibold text-ink">Emergency contact</p>
                <p className="text-ds-xs text-muted">Someone we can reach if anything goes wrong during a visit.</p>
              </div>
              <Input id="ecName" label="Full name" placeholder="e.g. Ngozi Obi" value={ecName} onChange={e => setEcName(e.target.value)} />
              <Input id="ecPhone" label="Phone number" type="tel" inputMode="tel" placeholder="+234 800 000 0000"
                value={ecPhone} onChange={e => setEcPhone(e.target.value)} />
              <SelectField id="ecRel" label="Relationship" value={ecRelation} onChange={setEcRelation}>
                <option value="">Select</option>
                {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                {ecRelation && !RELATIONSHIPS.includes(ecRelation) && <option value={ecRelation}>{ecRelation}</option>}
              </SelectField>
            </fieldset>

            {error && <Notice tone="danger">{error}</Notice>}

            <Button type="submit" block size="lg" disabled={saving} className="mt-2">
              {saving ? "Saving…" : "Save and continue"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
