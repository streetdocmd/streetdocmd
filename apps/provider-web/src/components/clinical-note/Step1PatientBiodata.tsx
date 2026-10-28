"use client";
import { useState } from "react";

const ATTENDANCE_OPTIONS = ["Patient Only", "Spouse", "Child", "Parent", "Caregiver", "Other"];

function calcAge(dob: string | null): string {
  if (!dob) return "Unknown";
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000)) + " yrs";
}

export default function Step1PatientBiodata({
  patient, value, onChange,
}: {
  patient: any;
  noteId: string;
  bookingId: string;
  provider: any;
  value: any;
  onChange: (v: any) => void;
}) {
  const [selected, setSelected] = useState<string[]>(value?.selected ?? []);
  const [otherText, setOtherText] = useState(value?.other ?? "");

  const toggle = (opt: string) => {
    const next = selected.includes(opt) ? selected.filter(x => x !== opt) : [...selected, opt];
    setSelected(next);
    onChange({ selected: next, other: otherText });
  };

  const handleOther = (v: string) => {
    setOtherText(v);
    onChange({ selected, other: v });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-ds-lg font-bold text-navy">Step 1 — Patient Biodata</h2>

      {/* Read-only card */}
      <div className="bg-page border border-line rounded-xl p-4 space-y-3">
        <p className="text-xs text-muted font-medium uppercase tracking-wide">Auto-populated from patient profile</p>
        <div className="grid grid-cols-2 gap-3">
          <Bio label="Full Name" value={patient?.name} />
          <Bio label="Age" value={calcAge(patient?.dob)} />
          <Bio label="Gender" value={patient?.gender} />
          <Bio label="Blood Group" value={patient?.blood_group} />
        </div>
        {patient?.known_conditions?.length > 0 && (
          <Bio label="Known Conditions" value={(patient.known_conditions as string[]).join(", ")} />
        )}
        {patient?.current_medications?.length > 0 && (
          <Bio label="Current Medications" value={(patient.current_medications as string[]).join(", ")} />
        )}
        {patient?.allergies?.length > 0 && (
          <Bio label="Allergies" value={(patient.allergies as string[]).join(", ")} />
        )}
      </div>

      {/* People in attendance */}
      <div className="card p-4 space-y-3">
        <div>
          <p className="font-semibold text-ink">Who was present during the consultation?</p>
          <p className="text-xs text-muted mt-0.5">Required — select all that apply</p>
        </div>
        <div className="space-y-2">
          {ATTENDANCE_OPTIONS.map(opt => (
            <label key={opt} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-sm text-ink">{opt}</span>
            </label>
          ))}
        </div>
        {selected.includes("Other") && (
          <input
            type="text"
            value={otherText}
            onChange={e => handleOther(e.target.value)}
            placeholder="Please specify..."
            className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        )}
        {selected.length === 0 && (
          <p className="text-xs text-red-500">Please select at least one option to continue.</p>
        )}
      </div>
    </div>
  );
}

function Bio({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted font-medium uppercase tracking-wide">{label}</p>
      <p className="text-sm text-ink mt-0.5">{value ?? "—"}</p>
    </div>
  );
}
