"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import Step1PatientBiodata from "@/components/clinical-note/Step1PatientBiodata";
import Step2PresentingComplaints from "@/components/clinical-note/Step2PresentingComplaints";
import Step3ChronicIssues from "@/components/clinical-note/Step3ChronicIssues";
import Step4History from "@/components/clinical-note/Step4History";
import Step5CurrentMedications from "@/components/clinical-note/Step5CurrentMedications";
import Step6SocialHistory from "@/components/clinical-note/Step6SocialHistory";
import Step7Allergies from "@/components/clinical-note/Step7Allergies";
import Step8GeneralExamination from "@/components/clinical-note/Step8GeneralExamination";
import Step9Vitals from "@/components/clinical-note/Step9Vitals";
import Step10SystemicExamination from "@/components/clinical-note/Step10SystemicExamination";
import Step11DiagnosisSearch from "@/components/clinical-note/Step11DiagnosisSearch";
import Step12Interventions from "@/components/clinical-note/Step12Interventions";
import Step13Recommendations from "@/components/clinical-note/Step13Recommendations";
import Step14FollowUp from "@/components/clinical-note/Step14FollowUp";
import SubmissionReview from "@/components/clinical-note/SubmissionReview";
import PreviousNotes from "@/components/clinical-note/PreviousNotes";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STEP_LABELS = [
  "Patient", "Complaints", "Chronic", "History",
  "Medications", "Social", "Allergies", "Examination",
  "Vitals", "Systemic", "Diagnosis", "Interventions",
  "Recommendations", "Follow-up"
];

export default function ClinicalNoteClient({
  noteId, bookingId, provider, patient, previousNotes,
}: {
  noteId: string;
  bookingId: string;
  provider: { id: string; name: string; credentials?: string; specialty?: string };
  patient: any;
  previousNotes: any[];
}) {
  const [step, setStep] = useState(1);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // All note data keyed by field name matching clinical_notes columns
  const [noteData, setNoteData] = useState<Record<string, any>>({
    people_in_attendance: null,
    presenting_complaints: null,
    chronic_issues: null,
    history: null,
    social_history: null,
    general_examination: null,
    systemic_examinations: null,
    interventions: null,
    recommendations: null,
    follow_up_date: null,
    safeguarding_flag: false,
  });

  const [vitalsData, setVitalsData] = useState<Record<string, any>>({});
  const [diagnosesData, setDiagnosesData] = useState<any[]>([]);

  const noteDataRef = useRef(noteData);
  noteDataRef.current = noteData;
  const vitalsRef = useRef(vitalsData);
  vitalsRef.current = vitalsData;
  const diagnosesRef = useRef(diagnosesData);
  diagnosesRef.current = diagnosesData;

  const saveDraft = useCallback(async () => {
    const { error } = await supabase
      .from("clinical_notes")
      .update({ ...noteDataRef.current, updated_at: new Date().toISOString() })
      .eq("id", noteId);
    if (!error) {
      setSavedAt(new Date());
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    }
  }, [noteId]);

  // Auto-save every 60 seconds
  useEffect(() => {
    const interval = setInterval(saveDraft, 60000);
    return () => clearInterval(interval);
  }, [saveDraft]);

  const updateField = (field: string, value: any) => {
    setNoteData(prev => ({ ...prev, [field]: value }));
  };

  const goNext = async () => {
    await saveDraft();
    if (step < 14) setStep(s => s + 1);
    else setStep(15); // review step
  };

  const goBack = () => {
    if (step > 1) setStep(s => s - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/clinical-note/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteId,
          bookingId,
          noteData: noteDataRef.current,
          vitalsData: vitalsRef.current,
          diagnosesData: diagnosesRef.current,
          patientId: patient?.id,
          providerId: provider.id,
        }),
      });
      if (res.ok) {
        window.location.href = "/dashboard?notice=note_submitted";
      } else {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body.error ?? `Submission failed (${res.status}). Please try again.`);
      }
    } catch (e: any) {
      setSubmitError(e?.message ?? "Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    const props = { patient, noteId, bookingId, provider };
    switch (step) {
      case 1:  return <Step1PatientBiodata {...props} value={noteData.people_in_attendance} onChange={v => updateField("people_in_attendance", v)} />;
      case 2:  return <Step2PresentingComplaints value={noteData.presenting_complaints} onChange={v => updateField("presenting_complaints", v)} />;
      case 3:  return <Step3ChronicIssues patient={patient} value={noteData.chronic_issues} onChange={v => updateField("chronic_issues", v)} />;
      case 4:  return <Step4History patient={patient} value={noteData.history} onChange={v => updateField("history", v)} />;
      case 5:  return <Step5CurrentMedications patient={patient} value={noteData.current_medications_note} onChange={v => updateField("current_medications_note", v)} />;
      case 6:  return <Step6SocialHistory value={noteData.social_history} onChange={v => updateField("social_history", v)} />;
      case 7:  return <Step7Allergies patient={patient} value={noteData.allergies_note} onChange={v => updateField("allergies_note", v)} />;
      case 8:  return <Step8GeneralExamination value={noteData.general_examination} onChange={v => updateField("general_examination", v)} />;
      case 9:  return <Step9Vitals value={vitalsData} onChange={setVitalsData} />;
      case 10: return <Step10SystemicExamination value={noteData.systemic_examinations} onChange={v => updateField("systemic_examinations", v)} />;
      case 11: return <Step11DiagnosisSearch noteId={noteId} providerId={provider.id} patientId={patient?.id} value={diagnosesData} onChange={setDiagnosesData} />;
      case 12: return <Step12Interventions value={noteData.interventions} onChange={v => updateField("interventions", v)} />;
      case 13: return <Step13Recommendations bookingId={bookingId} patientId={patient?.id ?? ""} providerId={provider.id} value={noteData.recommendations} onChange={v => updateField("recommendations", v)} />;
      case 14: return <Step14FollowUp noteId={noteId} patientId={patient?.id} value={{ date: noteData.follow_up_date, safeguarding: noteData.safeguarding_flag }} onChange={v => { updateField("follow_up_date", v.date); updateField("safeguarding_flag", v.safeguarding); }} />;
      case 15: return <SubmissionReview noteData={noteData} vitalsData={vitalsData} diagnosesData={diagnosesData} onSubmit={handleSubmit} submitting={submitting} submitError={submitError} onBack={() => setStep(14)} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Fixed Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Patient</p>
            <p className="font-semibold text-gray-900">{patient?.name ?? "Unknown Patient"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 font-mono">{bookingId.slice(0, 8).toUpperCase()}</p>
            {showSaved && <p className="text-xs text-green-600 transition-opacity">Draft saved</p>}
          </div>
        </div>

        {/* Step Progress Bar */}
        {step <= 14 && (
          <div className="max-w-3xl mx-auto mt-3">
            <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
              {STEP_LABELS.map((label, i) => {
                const n = i + 1;
                const isComplete = n < step;
                const isCurrent = n === step;
                return (
                  <button
                    key={n}
                    onClick={() => n < step && setStep(n)}
                    className={`flex flex-col items-center min-w-[3.2rem] group ${n < step ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                      ${isComplete ? "bg-green-500 text-white" : isCurrent ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>
                      {isComplete ? "✓" : n}
                    </div>
                    <span className={`text-[9px] mt-0.5 leading-tight text-center
                      ${isComplete ? "text-green-600" : isCurrent ? "text-blue-600 font-semibold" : "text-gray-400"}`}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-1.5 h-1 bg-gray-200 rounded-full">
              <div
                className="h-1 bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${((step - 1) / 14) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Previous Notes accordion (above step 1) */}
      {step === 1 && previousNotes.length > 0 && (
        <div className="max-w-3xl mx-auto w-full px-4 mt-4">
          <PreviousNotes notes={previousNotes} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-4">
        {renderStep()}
      </div>

      {/* Bottom Nav */}
      {step <= 14 && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3">
          <div className="max-w-3xl mx-auto flex gap-3">
            {step > 1 && (
              <button onClick={goBack} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors">
                ← Back
              </button>
            )}
            <button onClick={saveDraft} className="px-4 py-3 rounded-xl border border-teal-200 text-teal-700 font-medium hover:bg-teal-50 transition-colors text-sm">
              Save Draft
            </button>
            <button onClick={goNext} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors">
              {step === 14 ? "Review & Submit →" : "Next →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
