"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { normalizePhone, PHONE_ERROR } from "@/lib/phone";
import { Button, Chip, Notice, fieldLabelClass, inputClass } from "@/components/ds";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function EditProfileForm({ userId, profile }: { userId: string; profile: any }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [dob, setDob] = useState<string>(profile?.dob ?? "");
  const [gender, setGender] = useState<string>(profile?.gender ?? "");
  const [bloodGroup, setBloodGroup] = useState(profile?.blood_group ?? "");
  const [conditions, setConditions] = useState((profile?.known_conditions ?? []).join(", "));
  const [allergies, setAllergies] = useState((profile?.allergies ?? []).join(", "));
  const [medications, setMedications] = useState((profile?.current_medications ?? []).join(", "));
  const [emergencyName, setEmergencyName] = useState(profile?.emergency_contact_name ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState(profile?.emergency_contact_phone ?? "");
  const [emergencyRel, setEmergencyRel] = useState(profile?.emergency_contact_relationship ?? "");

  const parse = (v: string) => v.split(",").map(s => s.trim()).filter(Boolean);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const today = new Date().toISOString().split("T")[0];
    if (dob && (dob > today || dob < "1900-01-01")) { setError("Please enter a valid date of birth."); return; }
    let ecPhone: string | null = null;
    if (emergencyPhone.trim() && emergencyPhone === profile?.emergency_contact_phone) {
      ecPhone = emergencyPhone; // unchanged — don't block saving other fields on a legacy format
    } else if (emergencyPhone.trim()) {
      ecPhone = normalizePhone(emergencyPhone);
      if (!ecPhone) { setError(`Emergency contact: ${PHONE_ERROR}`); return; }
    }
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.from("users").update({
      dob: dob || null,
      gender: gender || null,
      blood_group: bloodGroup || null,
      known_conditions: parse(conditions),
      allergies: parse(allergies),
      current_medications: parse(medications),
      emergency_contact_name: emergencyName.trim() || null,
      emergency_contact_phone: ecPhone,
      emergency_contact_relationship: emergencyRel.trim() || null,
    }).eq("id", userId);
    setSaving(false);
    if (err) { setError("Could not save. Please try again."); return; }
    router.push("/dashboard/profile");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      <div className="space-y-4 rounded-ds-lg border border-line bg-surface p-5 shadow-ds-sm">
        <h2 className="text-ds-control font-bold text-navy">About you</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={fieldLabelClass} htmlFor="dob">Date of birth</label>
            <input id="dob" type="date" className={inputClass()} value={dob} onChange={e => setDob(e.target.value)}
              min="1900-01-01" max={new Date().toISOString().split("T")[0]} />
          </div>
          <div>
            <label className={fieldLabelClass} htmlFor="gender">Gender</label>
            <select id="gender" className={inputClass(false, "appearance-none")} value={gender} onChange={e => setGender(e.target.value)}>
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-ds-lg border border-line bg-surface p-5 shadow-ds-sm">
        <h2 className="mb-3 text-ds-control font-bold text-navy">Blood group</h2>
        <div className="flex flex-wrap gap-2">
          {BLOOD_GROUPS.map(bg => (
            <Chip key={bg} selected={bloodGroup === bg} onClick={() => setBloodGroup(bg === bloodGroup ? "" : bg)}>
              {bg}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-4 rounded-ds-lg border border-line bg-surface p-5 shadow-ds-sm">
        <h2 className="text-ds-control font-bold text-navy">Medical history</h2>
        <div>
          <label className={fieldLabelClass}>Known conditions <span className="font-normal text-muted">(separate with commas)</span></label>
          <input className={inputClass()} value={conditions} onChange={e => setConditions(e.target.value)}
            placeholder="e.g. Hypertension, Diabetes" />
        </div>
        <div>
          <label className={fieldLabelClass}>Allergies</label>
          <input className={inputClass()} value={allergies} onChange={e => setAllergies(e.target.value)}
            placeholder="e.g. Penicillin, Peanuts" />
        </div>
        <div>
          <label className={fieldLabelClass}>Current medications</label>
          <input className={inputClass()} value={medications} onChange={e => setMedications(e.target.value)}
            placeholder="e.g. Lisinopril 10mg, Metformin 500mg" />
        </div>
      </div>

      <div className="space-y-4 rounded-ds-lg border border-line bg-surface p-5 shadow-ds-sm">
        <h2 className="text-ds-control font-bold text-navy">Emergency contact</h2>
        <div>
          <label className={fieldLabelClass}>Full name</label>
          <input className={inputClass()} value={emergencyName} onChange={e => setEmergencyName(e.target.value)} placeholder="Contact name" />
        </div>
        <div>
          <label className={fieldLabelClass}>Phone number</label>
          <input type="tel" inputMode="tel" className={inputClass()} value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} placeholder="08012345678" />
        </div>
        <div>
          <label className={fieldLabelClass}>Relationship</label>
          <input className={inputClass()} value={emergencyRel} onChange={e => setEmergencyRel(e.target.value)} placeholder="e.g. Spouse, Parent" />
        </div>
      </div>

      {error && (
        <Notice tone="danger">{error}</Notice>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}