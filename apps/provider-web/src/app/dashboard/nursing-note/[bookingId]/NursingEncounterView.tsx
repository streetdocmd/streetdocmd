import Link from "next/link";

// Read-only display of an already-submitted nursing encounter. Submitted
// notes are locked (see SubmissionReview's own copy: "Once submitted, this
// note is locked and cannot be edited without admin approval") — this is
// what a nurse sees when they click "View Note" on a completed booking,
// instead of the editable NursingEncounterClient form.
export default function NursingEncounterView({ encounter, patient }: { encounter: any; patient: any }) {
  const vitals = encounter.vitals ?? {};
  const hasVitals = Object.values(vitals).some(v => v);

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nursing Encounter</h1>
          <p className="text-sm text-gray-500">{patient?.name ?? "Patient"}</p>
        </div>
        <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-3 py-1 font-medium">
          ✓ Submitted{encounter.submitted_at ? ` · ${new Date(encounter.submitted_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}` : ""}
        </span>
      </div>

      <Section title="1. Visit Reason">{encounter.visit_reason || <Empty />}</Section>
      <Section title="2. Patient Assessment">{encounter.patient_assessment?.notes || <Empty />}</Section>

      <Section title="3. Vital Signs">
        {hasVitals ? (
          <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
            {vitals.bp_systolic && <Field label="BP Systolic" value={vitals.bp_systolic} />}
            {vitals.bp_diastolic && <Field label="BP Diastolic" value={vitals.bp_diastolic} />}
            {vitals.pulse_rate && <Field label="Pulse Rate" value={vitals.pulse_rate} />}
            {vitals.temperature && <Field label="Temperature (°C)" value={vitals.temperature} />}
            {vitals.spo2 && <Field label="SpO2 (%)" value={vitals.spo2} />}
            {vitals.respiratory_rate && <Field label="Respiratory Rate" value={vitals.respiratory_rate} />}
          </div>
        ) : <Empty />}
      </Section>

      <Section title="4. Nursing Assessment">{encounter.nursing_assessment?.notes || <Empty />}</Section>

      <Section title="5. Nursing Intervention">
        {encounter.intervention?.performed?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {encounter.intervention.performed.map((opt: string) => (
              <span key={opt} className="text-xs px-3 py-1.5 rounded-full bg-teal-brand text-white">
                {opt.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
        {encounter.intervention?.notes || (!encounter.intervention?.performed?.length && <Empty />)}
      </Section>

      <Section title="6. Patient Education">{encounter.patient_education?.notes || <Empty />}</Section>

      <Section title="7. Outcome">
        {encounter.outcome?.status && (
          <span className="text-xs px-3 py-1.5 rounded-full bg-teal-brand text-white capitalize inline-block mb-2">
            {encounter.outcome.status}
          </span>
        )}
        {encounter.outcome?.notes || (!encounter.outcome?.status && <Empty />)}
      </Section>

      <Section title="8. Escalation">
        {encounter.escalation?.escalated ? (encounter.escalation.details || "Escalated — no further detail recorded.") : <Empty text="Not escalated." />}
      </Section>

      <Section title="9. Care Tasks">
        {encounter.care_tasks?.length > 0 ? (
          <div className="space-y-1.5">
            {encounter.care_tasks.map((t: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                <span>{t.completed ? "☑" : "☐"}</span>
                <span className={t.completed ? "line-through text-gray-400" : ""}>{t.task}</span>
              </div>
            ))}
          </div>
        ) : <Empty />}
      </Section>

      <Section title="10. Follow-up">
        {encounter.follow_up_date ? (
          <>
            <p className="text-sm text-gray-700 font-medium">
              {new Date(encounter.follow_up_date).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
            </p>
            {encounter.follow_up_notes && <p className="text-sm text-gray-600 mt-1">{encounter.follow_up_notes}</p>}
          </>
        ) : <Empty text="No follow-up scheduled." />}
      </Section>

      {encounter.safeguarding_flag && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          ⚠ A safeguarding concern was flagged for this visit.
        </div>
      )}

      <Link
        href="/dashboard/bookings"
        className="block text-center border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
      >
        ← Back to Bookings
      </Link>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">{title}</h3>
      <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Empty({ text = "Not recorded." }: { text?: string }) {
  return <span className="text-gray-400 italic">{text}</span>;
}
