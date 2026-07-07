"use client";

type Props = {
  noteData: Record<string, any>;
  vitalsData: Record<string, any>;
  diagnosesData: any[];
  onSubmit: () => void;
  submitting: boolean;
  onBack: () => void;
};

type SectionCheck = { label: string; complete: boolean; required: boolean };

function checkComplete(noteData: Record<string, any>, vitalsData: Record<string, any>, diagnosesData: any[]): SectionCheck[] {
  return [
    { label: "Patient Biodata & Attendance", complete: !!(noteData.people_in_attendance?.selected?.length), required: true },
    { label: "Presenting Complaints", complete: !!(noteData.presenting_complaints?.length && noteData.presenting_complaints[0]?.description), required: true },
    { label: "Chronic Issues", complete: !!(noteData.chronic_issues), required: false },
    { label: "History", complete: !!(noteData.history && Object.values(noteData.history).some(v => v)), required: false },
    { label: "Current Medications", complete: !!(noteData.current_medications_note?.length), required: false },
    { label: "Social History", complete: !!(noteData.social_history && Object.values(noteData.social_history).some(v => v)), required: false },
    { label: "Allergies", complete: !!(noteData.allergies_note), required: false },
    { label: "General Examination", complete: !!(noteData.general_examination?.selected?.length), required: false },
    { label: "Vitals", complete: !!(vitalsData.bp_systolic && vitalsData.bp_diastolic && vitalsData.pulse_rate), required: true },
    { label: "Systemic Examination", complete: !!(noteData.systemic_examinations && Object.keys(noteData.systemic_examinations).length > 0), required: false },
    { label: "Diagnosis", complete: !!(diagnosesData.length > 0 && diagnosesData[0]?.clinical_description), required: true },
    { label: "Interventions", complete: !!(noteData.interventions && Object.values(noteData.interventions).some(v => v)), required: false },
    { label: "Recommendations", complete: !!(noteData.recommendations && Object.values(noteData.recommendations).some(v => v)), required: true },
    { label: "Follow-up Date", complete: !!(noteData.follow_up_date), required: false },
  ];
}

export default function SubmissionReview({ noteData, vitalsData, diagnosesData, onSubmit, submitting, onBack }: Props) {
  const sections = checkComplete(noteData, vitalsData, diagnosesData);
  const requiredMissing = sections.filter(s => s.required && !s.complete);
  const canSubmit = requiredMissing.length === 0;

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Review & Submit</h2>
        <p className="text-sm text-gray-500 mt-0.5">Check that all required sections are complete before submitting</p>
      </div>

      {/* Section checklist */}
      <div className="card overflow-hidden">
        {sections.map((s, i) => (
          <div key={i} className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0 ${s.required && !s.complete ? "bg-red-50" : ""}`}>
            <div className="flex items-center gap-2">
              <span className={`text-sm ${s.required && !s.complete ? "text-red-700 font-medium" : "text-gray-700"}`}>
                {i + 1}. {s.label}
              </span>
              {s.required && <span className="text-xs text-red-500 font-medium">Required</span>}
            </div>
            <span className={`text-base ${s.complete ? "text-green-500" : "text-gray-300"}`}>
              {s.complete ? "✓" : "✗"}
            </span>
          </div>
        ))}
      </div>

      {/* Summary of key data */}
      {diagnosesData.length > 0 && (
        <div className="card p-4 space-y-2">
          <p className="text-sm font-semibold text-gray-700">Diagnoses</p>
          {diagnosesData.map((d, i) => (
            <div key={i} className="text-sm text-gray-600">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium mr-2 ${i === 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                {i === 0 ? "Primary" : "Secondary"}
              </span>
              {d.clinical_description}
              {d.icd10_code && d.icd10_code !== "Uncodified" && <span className="text-gray-400 ml-1">({d.icd10_code})</span>}
            </div>
          ))}
        </div>
      )}

      {vitalsData.bp_systolic && (
        <div className="card p-4 space-y-1">
          <p className="text-sm font-semibold text-gray-700">Vitals Summary</p>
          <p className="text-sm text-gray-600">BP: {vitalsData.bp_systolic}/{vitalsData.bp_diastolic} mmHg · PR: {vitalsData.pulse_rate} bpm {vitalsData.pulse_rhythm}</p>
          {vitalsData.temperature && <p className="text-sm text-gray-600">Temp: {vitalsData.temperature}°{vitalsData.temp_unit} · SpO₂: {vitalsData.spo2}%</p>}
        </div>
      )}

      {/* Submit */}
      <div className="space-y-3">
        {!canSubmit && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-700 mb-1">Please complete required sections:</p>
            <ul className="text-sm text-red-600 space-y-0.5">
              {requiredMissing.map(s => <li key={s.label}>• {s.label}</li>)}
            </ul>
          </div>
        )}

        <button
          onClick={onBack}
          className="w-full py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
        >
          ← Back to Step 14
        </button>

        <button
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          className="w-full bg-green-600 text-white py-4 rounded-xl text-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting..." : "Submit Clinical Note"}
        </button>

        <p className="text-xs text-center text-gray-400">
          Once submitted, this note is locked and cannot be edited without admin approval.
        </p>
      </div>
    </div>
  );
}
