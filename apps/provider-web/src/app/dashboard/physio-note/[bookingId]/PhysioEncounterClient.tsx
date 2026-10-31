"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { saveNoteDraft } from "@/lib/note-draft";
import { FOLLOW_UP_TYPES_BY_PROFESSION, FOLLOW_UP_TYPE_LABELS, type FollowUpType } from "@streetdocmd/shared";

const supabase = createClient();

const PAIN_SCALE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const INTERVENTION_OPTIONS = [
  "manual_therapy", "therapeutic_exercise", "electrotherapy",
  "gait_training", "balance_training", "stretching", "strengthening", "other",
];
const PROGRESS_OPTIONS = ["improving", "unchanged", "regressing"] as const;

export default function PhysioEncounterClient({
  encounterId, draft, bookingId, provider, patient,
}: {
  encounterId: string;
  /** The saved physiotherapy_encounters row when resuming */
  draft?: Record<string, any> | null;
  bookingId: string;
  provider: { id: string; name: string; credentials?: string };
  patient: any;
}) {
  const router = useRouter();
  const [showSaved, setShowSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [referralReason, setReferralReason] = useState<string>(draft?.referral_reason ?? "");
  const [subjective, setSubjective] = useState<string>(draft?.subjective_assessment?.notes ?? "");
  const [painScore, setPainScore] = useState<number | null>(draft?.pain_symptoms?.score ?? null);
  const [painLocation, setPainLocation] = useState<string>(draft?.pain_symptoms?.location ?? "");
  const [objective, setObjective] = useState<string>(draft?.objective_assessment?.notes ?? "");
  const [rom, setRom] = useState<string>(draft?.functional_measurements?.range_of_motion ?? "");
  const [strength, setStrength] = useState<string>(draft?.functional_measurements?.strength ?? "");
  const [mobility, setMobility] = useState<string>(draft?.functional_measurements?.mobility ?? "");
  const [gaitBalance, setGaitBalance] = useState<string>(draft?.functional_measurements?.gait_balance ?? "");
  const [professionalAssessment, setProfessionalAssessment] = useState<string>(draft?.professional_assessment?.notes ?? "");
  const [interventionsDone, setInterventionsDone] = useState<string[]>(draft?.intervention?.performed ?? []);
  const [interventionNotes, setInterventionNotes] = useState<string>(draft?.intervention?.notes ?? "");
  const [patientResponse, setPatientResponse] = useState<string>(draft?.patient_response?.notes ?? "");
  const [progressStatus, setProgressStatus] = useState<string>(draft?.progress?.status ?? "unchanged");
  const [progressNotes, setProgressNotes] = useState<string>(draft?.progress?.notes ?? "");
  const [homeProgram, setHomeProgram] = useState<string>(draft?.home_program?.notes ?? "");
  const [nextSessionPlan, setNextSessionPlan] = useState<string>(draft?.next_session_plan ?? "");
  const [followUpDate, setFollowUpDate] = useState<string>(draft?.follow_up_date ?? "");
  // Kept out of stateRef (spread directly into a physiotherapy_encounters
  // UPDATE on every autosave) — follow_up_type isn't a column there.
  const [followUpType, setFollowUpType] = useState<FollowUpType>(draft?.draft_state?.follow_up_type ?? "home_visit");
  const followUpTypeRef = useRef(followUpType);
  followUpTypeRef.current = followUpType;

  const stateRef = useRef<any>({});
  stateRef.current = {
    referral_reason: referralReason,
    subjective_assessment: subjective ? { notes: subjective } : null,
    pain_symptoms: (painScore !== null || painLocation) ? { score: painScore, location: painLocation } : null,
    objective_assessment: objective ? { notes: objective } : null,
    functional_measurements: (rom || strength || mobility || gaitBalance)
      ? { range_of_motion: rom, strength, mobility, gait_balance: gaitBalance } : null,
    professional_assessment: professionalAssessment ? { notes: professionalAssessment } : null,
    intervention: (interventionsDone.length || interventionNotes)
      ? { performed: interventionsDone, notes: interventionNotes } : null,
    patient_response: patientResponse ? { notes: patientResponse } : null,
    progress: progressNotes || progressStatus ? { status: progressStatus, notes: progressNotes } : null,
    home_program: homeProgram ? { notes: homeProgram } : null,
    next_session_plan: nextSessionPlan || null,
    follow_up_date: followUpDate || null,
  };

  const saveDraft = useCallback(async () => {
    const ok = await saveNoteDraft(supabase, "physiotherapy_encounters", encounterId, stateRef.current, { follow_up_type: followUpTypeRef.current });
    setSaveFailed(!ok);
    if (ok) {
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    }
  }, [encounterId]);

  useEffect(() => {
    const interval = setInterval(saveDraft, 60000);
    return () => clearInterval(interval);
  }, [saveDraft]);

  function toggleIntervention(opt: string) {
    setInterventionsDone(prev => prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]);
  }

  async function handleSubmit() {
    if (!subjective.trim() && !objective.trim()) {
      setSubmitError("Please record at least a subjective or objective assessment before submitting.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/physio-encounter/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encounterId, bookingId,
          patientId: patient?.id, providerId: provider.id,
          encounterData: stateRef.current,
          followUpType,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error ?? "Could not submit encounter. Please try again.");
        setSubmitting(false);
        return;
      }
      router.push("/dashboard/bookings");
    } catch {
      setSubmitError("Could not reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-ds-xl font-bold text-navy">Physiotherapy Encounter</h1>
          <p className="text-sm text-muted">{patient?.name ?? "Patient"}</p>
        </div>
        {showSaved && <span className="text-xs text-teal-deep font-medium">Draft saved</span>}
        {saveFailed && <span role="alert" className="text-xs font-semibold text-red-600">Draft not saved. Check your connection and try again.</span>}
      </div>

      <Section title="1. Referral / Reason">
        <textarea className="input" rows={2} placeholder="Why was physiotherapy requested?"
          value={referralReason} onChange={e => setReferralReason(e.target.value)} />
      </Section>

      <Section title="2. Subjective Assessment">
        <textarea className="input" rows={3} placeholder="Patient's own description of their condition"
          value={subjective} onChange={e => setSubjective(e.target.value)} />
      </Section>

      <Section title="3. Pain / Symptoms">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PAIN_SCALE.map(n => (
            <button key={n} type="button" onClick={() => setPainScore(n)}
              className={`w-8 h-8 rounded-full text-xs font-medium border transition-colors ${
                painScore === n ? "bg-teal-deep text-white border-teal-deep" : "bg-white text-muted border-line"
              }`}>
              {n}
            </button>
          ))}
        </div>
        <input className="input" placeholder="Pain location (e.g. lower back, left knee)"
          value={painLocation} onChange={e => setPainLocation(e.target.value)} />
      </Section>

      <Section title="4. Objective Assessment">
        <textarea className="input" rows={3} placeholder="Therapist's observations on examination"
          value={objective} onChange={e => setObjective(e.target.value)} />
      </Section>

      <Section title="5. Functional Measurements">
        <div className="grid grid-cols-2 gap-3">
          <LabeledInput label="Range of Motion" value={rom} onChange={setRom} />
          <LabeledInput label="Strength" value={strength} onChange={setStrength} />
          <LabeledInput label="Mobility" value={mobility} onChange={setMobility} />
          <LabeledInput label="Gait / Balance" value={gaitBalance} onChange={setGaitBalance} />
        </div>
      </Section>

      <Section title="6. Professional Assessment">
        <textarea className="input" rows={3} placeholder="Clinical impression and reasoning"
          value={professionalAssessment} onChange={e => setProfessionalAssessment(e.target.value)} />
      </Section>

      <Section title="7. Intervention">
        <div className="flex flex-wrap gap-2 mb-3">
          {INTERVENTION_OPTIONS.map(opt => (
            <button key={opt} type="button" onClick={() => toggleIntervention(opt)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                interventionsDone.includes(opt)
                  ? "bg-teal-deep text-white border-teal-deep"
                  : "bg-white text-muted border-line"
              }`}>
              {opt.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <textarea className="input" rows={2} placeholder="Additional intervention detail"
          value={interventionNotes} onChange={e => setInterventionNotes(e.target.value)} />
      </Section>

      <Section title="8. Patient Response">
        <textarea className="input" rows={2} placeholder="How did the patient respond to treatment?"
          value={patientResponse} onChange={e => setPatientResponse(e.target.value)} />
      </Section>

      <Section title="9. Progress">
        <div className="flex gap-2 mb-3">
          {PROGRESS_OPTIONS.map(opt => (
            <button key={opt} type="button" onClick={() => setProgressStatus(opt)}
              className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
                progressStatus === opt ? "bg-teal-deep text-white border-teal-deep" : "bg-white text-muted border-line"
              }`}>
              {opt}
            </button>
          ))}
        </div>
        <textarea className="input" rows={2} placeholder="Progress notes since last session"
          value={progressNotes} onChange={e => setProgressNotes(e.target.value)} />
      </Section>

      <Section title="10. Home Program">
        <textarea className="input" rows={3} placeholder="Exercises or advice given for the patient to continue at home"
          value={homeProgram} onChange={e => setHomeProgram(e.target.value)} />
      </Section>

      <Section title="11. Next Session">
        <input type="date" className="input mb-2" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
        {followUpDate && (
          <select className="input mb-2" value={followUpType} onChange={e => setFollowUpType(e.target.value as FollowUpType)}>
            {FOLLOW_UP_TYPES_BY_PROFESSION.physiotherapist.map(t => (
              <option key={t} value={t}>{FOLLOW_UP_TYPE_LABELS[t]}</option>
            ))}
          </select>
        )}
        <textarea className="input" rows={2} placeholder="Plan for the next session"
          value={nextSessionPlan} onChange={e => setNextSessionPlan(e.target.value)} />
      </Section>

      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{submitError}</div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-line p-4 flex gap-3 max-w-2xl mx-auto">
        <button type="button" onClick={saveDraft} className="flex-1 border border-line rounded-lg py-2.5 text-sm font-medium text-muted">
          Save draft
        </button>
        <button type="button" onClick={handleSubmit} disabled={submitting} className="btn-teal flex-1 py-2.5 text-sm">
          {submitting ? "Submitting…" : "Submit & Complete Visit"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-ink mb-3">{title}</h3>
      {children}
    </div>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-muted block mb-1">{label}</label>
      <input className="input" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
