"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PAIN_SCALE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const INTERVENTION_OPTIONS = [
  "manual_therapy", "therapeutic_exercise", "electrotherapy",
  "gait_training", "balance_training", "stretching", "strengthening", "other",
];
const PROGRESS_OPTIONS = ["improving", "unchanged", "regressing"] as const;

export default function PhysioEncounterClient({
  encounterId, bookingId, provider, patient,
}: {
  encounterId: string;
  bookingId: string;
  provider: { id: string; name: string; credentials?: string };
  patient: any;
}) {
  const router = useRouter();
  const [showSaved, setShowSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [referralReason, setReferralReason] = useState("");
  const [subjective, setSubjective] = useState("");
  const [painScore, setPainScore] = useState<number | null>(null);
  const [painLocation, setPainLocation] = useState("");
  const [objective, setObjective] = useState("");
  const [rom, setRom] = useState("");
  const [strength, setStrength] = useState("");
  const [mobility, setMobility] = useState("");
  const [gaitBalance, setGaitBalance] = useState("");
  const [professionalAssessment, setProfessionalAssessment] = useState("");
  const [interventionsDone, setInterventionsDone] = useState<string[]>([]);
  const [interventionNotes, setInterventionNotes] = useState("");
  const [patientResponse, setPatientResponse] = useState("");
  const [progressStatus, setProgressStatus] = useState<string>("unchanged");
  const [progressNotes, setProgressNotes] = useState("");
  const [homeProgram, setHomeProgram] = useState("");
  const [nextSessionPlan, setNextSessionPlan] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

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
    const { error } = await supabase
      .from("physiotherapy_encounters")
      .update({ ...stateRef.current, updated_at: new Date().toISOString() })
      .eq("id", encounterId);
    if (!error) {
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
          <h1 className="text-xl font-bold text-gray-900">Physiotherapy Encounter</h1>
          <p className="text-sm text-gray-500">{patient?.name ?? "Patient"}</p>
        </div>
        {showSaved && <span className="text-xs text-teal-brand font-medium">Draft saved</span>}
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
                painScore === n ? "bg-teal-brand text-white border-teal-brand" : "bg-white text-gray-600 border-gray-200"
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
                  ? "bg-teal-brand text-white border-teal-brand"
                  : "bg-white text-gray-600 border-gray-200"
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
                progressStatus === opt ? "bg-teal-brand text-white border-teal-brand" : "bg-white text-gray-600 border-gray-200"
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
        <textarea className="input" rows={2} placeholder="Plan for the next session"
          value={nextSessionPlan} onChange={e => setNextSessionPlan(e.target.value)} />
      </Section>

      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{submitError}</div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3 max-w-2xl mx-auto">
        <button type="button" onClick={saveDraft} className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-600">
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
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-gray-400 block mb-1">{label}</label>
      <input className="input" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
