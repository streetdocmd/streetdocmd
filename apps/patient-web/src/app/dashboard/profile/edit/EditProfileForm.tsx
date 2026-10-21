"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { normalizePhone, PHONE_ERROR } from "@/lib/phone";

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
      <div className="card p-6 space-y-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">About You</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="dob">Date of birth</label>
            <input id="dob" type="date" className="input" value={dob} onChange={e => setDob(e.target.value)}
              min="1900-01-01" max={new Date().toISOString().split("T")[0]} />
          </div>
          <div>
            <label className="label" htmlFor="gender">Gender</label>
            <select id="gender" className="input" value={gender} onChange={e => setGender(e.target.value)}>
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Blood Group</h2>
        <div className="flex flex-wrap gap-2">
          {BLOOD_GROUPS.map(bg => (
            <button
              key={bg}
              type="button"
              onClick={() => setBloodGroup(bg === bloodGroup ? "" : bg)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                bloodGroup === bg
                  ? "bg-blue-brand text-white border-blue-brand"
                  : "bg-white text-gray-700 border-gray-200 hover:border-blue-brand hover:text-blue-brand"
              }`}
            >
              {bg}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Medical History</h2>
        <div>
          <label className="label">Known Conditions <span className="text-gray-400 font-normal">(comma-separated)</span></label>
          <input className="input" value={conditions} onChange={e => setConditions(e.target.value)}
            placeholder="e.g. Hypertension, Diabetes" />
        </div>
        <div>
          <label className="label">Allergies</label>
          <input className="input" value={allergies} onChange={e => setAllergies(e.target.value)}
            placeholder="e.g. Penicillin, Peanuts" />
        </div>
        <div>
          <label className="label">Current Medications</label>
          <input className="input" value={medications} onChange={e => setMedications(e.target.value)}
            placeholder="e.g. Lisinopril 10mg, Metformin 500mg" />
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Emergency Contact</h2>
        <div>
          <label className="label">Full name</label>
          <input className="input" value={emergencyName} onChange={e => setEmergencyName(e.target.value)} placeholder="Contact name" />
        </div>
        <div>
          <label className="label">Phone number</label>
          <input type="tel" inputMode="tel" className="input" value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} placeholder="08012345678" />
        </div>
        <div>
          <label className="label">Relationship</label>
          <input className="input" value={emergencyRel} onChange={e => setEmergencyRel(e.target.value)} placeholder="e.g. Spouse, Parent" />
        </div>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
      </div>
    </form>
  );
}