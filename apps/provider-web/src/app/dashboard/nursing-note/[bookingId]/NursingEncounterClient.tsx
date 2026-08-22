"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const OUTCOME_OPTIONS = ["improved", "stable", "deteriorated"] as const;
const INTERVENTION_OPTIONS = [
  "wound_dressing", "medication_administration", "injection",
  "catheter_care", "health_education", "vital_monitoring", "other",
];

type CareTask = { task: string; completed: boolean };

export default function NursingEncounterClient({
  encounterId, bookingId, provider, patient,
}: {
  encounterId: string;
  bookingId: string;
  provider: { id: string; name: string; credentials?: string };
  patient: any;
}) {
  const router = useRouter();
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [visitReason, setVisitReason] = useState("");
  const [patientAssessment, setPatientAssessment] = useState("");
  const [vitals, setVitals] = useState<Record<string, string>>({});
  const [nursingAssessment, setNursingAssessment] = useState("");
  const [interventionsDone, setInterventionsDone] = useState<string[]>([]);
  const [interventionNotes, setInterventionNotes] = useState("");
  const [educationTopics, setEducationTopics] = useState("");
  const [outcomeStatus, setOutcomeStatus] = useState<string>("stable");
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [escalated, setEscalated] = useState(false);
  const [escalationDetails, setEscalationDetails] = useState("");
  const [careTasks, setCareTasks] = useState<CareTask[]>([]);
  const [newTask, setNewTask] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [safeguardingFlag, setSafeguardingFlag] = useState(false);

  const stateRef = useRef<any>({});
  stateRef.current = {
    visit_reason: visitReason,
    patient_assessment: patientAssessment ? { notes: patientAssessment } : null,
    vitals: Object.values(vitals).some(v => v) ? vitals : null,
    nursing_assessment: nursingAssessment ? { notes: nursingAssessment } : null,
    intervention: (interventionsDone.length || interventionNotes)
      ? { performed: interventionsDone, notes: interventionNotes } : null,
    patient_education: educationTopics ? { notes: educationTopics } : null,
    outcome: outcomeNotes || outcomeStatus ? { status: outcomeStatus, notes: outcomeNotes } : null,
    escalation: escalated ? { escalated: true, details: escalationDetails } : null,
    care_tasks: careTasks.length > 0 ? careTasks : null,
    follow_up_date: followUpDate || null,
    follow_up_notes: followUpNotes || null,
    safeguarding_flag: safeguardingFlag,
  };

  const saveDraft = useCallback(async () => {
    const { error } = await supabase
      .from("nursing_encounters")
      .update({ ...stateRef.current, updated_at: new Date().toISOString() })
      .eq("id", encounterId);
    if (!error) {
      setSavedAt(new Date());
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

  function addTask() {
    if (!newTask.trim()) return;
    setCareTasks(prev => [...prev, { task: newTask.trim(), completed: false }]);
    setNewTask("");
  }

  function toggleTask(i: number) {
    setCareTasks(prev => prev.map((t, idx) => idx === i ? { ...t, completed: !t.completed } : t));
  }

  async function handleSubmit() {
    if (!visitReason.trim()) {
      setSubmitError("Please record the reason for this visit before submitting.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/nursing-encounter/submit", {
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
          <h1 className="text-xl font-bold text-gray-900">Nursing Encounter</h1>
          <p className="text-sm text-gray-500">{patient?.name ?? "Patient"}</p>
        </div>
        {showSaved && <span className="text-xs text-teal-brand font-medium">Draft saved</span>}
      </div>

      <Section title="1. Visit Reason">
        <textarea className="input" rows={2} placeholder="Why was this nursing visit requested?"
          value={visitReason} onChange={e => setVisitReason(e.target.value)} />
      </Section>

      <Section title="2. Patient Assessment">
        <textarea className="input" rows={3} placeholder="General condition, mobility, mental state, etc."
          value={patientAssessment} onChange={e => setPatientAssessment(e.target.value)} />
      </Section>

      <Section title="3. Vital Signs">
        <div className="grid grid-cols-2 gap-3">
          <LabeledInput label="BP Systolic" value={vitals.bp_systolic ?? ""} onChange={v => setVitals(p => ({ ...p, bp_systolic: v }))} />
          <LabeledInput label="BP Diastolic" value={vitals.bp_diastolic ?? ""} onChange={v => setVitals(p => ({ ...p, bp_diastolic: v }))} />
          <LabeledInput label="Pulse Rate" value={vitals.pulse_rate ?? ""} onChange={v => setVitals(p => ({ ...p, pulse_rate: v }))} />
          <LabeledInput label="Temperature (°C)" value={vitals.temperature ?? ""} onChange={v => setVitals(p => ({ ...p, temperature: v }))} />
          <LabeledInput label="SpO2 (%)" value={vitals.spo2 ?? ""} onChange={v => setVitals(p => ({ ...p, spo2: v }))} />
          <LabeledInput label="Respiratory Rate" value={vitals.respiratory_rate ?? ""} onChange={v => setVitals(p => ({ ...p, respiratory_rate: v }))} />
        </div>
      </Section>

      <Section title="4. Nursing Assessment">
        <textarea className="input" rows={3} placeholder="Wound status, skin integrity, hydration, nutrition, etc."
          value={nursingAssessment} onChange={e => setNursingAssessment(e.target.value)} />
      </Section>

      <Section title="5. Nursing Intervention">
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

      <Section title="6. Patient Education">
        <textarea className="input" rows={2} placeholder="What was explained/taught to the patient or caregiver?"
          value={educationTopics} onChange={e => setEducationTopics(e.target.value)} />
      </Section>

      <Section title="7. Outcome">
        <div className="flex gap-2 mb-3">
          {OUTCOME_OPTIONS.map(opt => (
            <button key={opt} type="button" onClick={() => setOutcomeStatus(opt)}
              className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
                outcomeStatus === opt ? "bg-teal-brand text-white border-teal-brand" : "bg-white text-gray-600 border-gray-200"
              }`}>
              {opt}
            </button>
          ))}
        </div>
        <textarea className="input" rows={2} placeholder="Outcome notes"
          value={outcomeNotes} onChange={e => setOutcomeNotes(e.target.value)} />
      </Section>

      <Section title="8. Escalation">
        <label className="flex items-center gap-2 mb-2 text-sm text-gray-700">
          <input type="checkbox" checked={escalated} onChange={e => setEscalated(e.target.checked)} />
          This case needs to be escalated (e.g. to a doctor or emergency care)
        </label>
        {escalated && (
          <textarea className="input" rows={2} placeholder="Escalated to whom, and why"
            value={escalationDetails} onChange={e => setEscalationDetails(e.target.value)} />
        )}
      </Section>

      <Section title="9. Care Tasks">
        <div className="flex gap-2 mb-3">
          <input className="input flex-1" placeholder="e.g. Change dressing daily"
            value={newTask} onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTask())} />
          <button type="button" onClick={addTask} className="btn-teal px-4 text-sm">Add</button>
        </div>
        <div className="space-y-1.5">
          {careTasks.map((t, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={t.completed} onChange={() => toggleTask(i)} />
              <span className={t.completed ? "line-through text-gray-400" : ""}>{t.task}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="10. Follow-up">
        <input type="date" className="input mb-2" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
        <textarea className="input" rows={2} placeholder="Next visit / follow-up notes"
          value={followUpNotes} onChange={e => setFollowUpNotes(e.target.value)} />
      </Section>

      <label className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
        <input type="checkbox" checked={safeguardingFlag} onChange={e => setSafeguardingFlag(e.target.checked)} />
        Flag a safeguarding concern for this visit
      </label>

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
