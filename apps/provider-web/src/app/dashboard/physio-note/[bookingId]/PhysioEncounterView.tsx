import Link from "next/link";

// Read-only display of an already-submitted physiotherapy encounter —
// mirrors NursingEncounterView's role for the nursing flow.
export default function PhysioEncounterView({ encounter, patient }: { encounter: any; patient: any }) {
  const fm = encounter.functional_measurements ?? {};
  const hasFm = Object.values(fm).some(v => v);

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-ds-xl font-bold text-navy">Physiotherapy Encounter</h1>
          <p className="text-sm text-muted">{patient?.name ?? "Patient"}</p>
        </div>
        <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-3 py-1 font-medium">
          ✓ Submitted{encounter.submitted_at ? ` · ${new Date(encounter.submitted_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}` : ""}
        </span>
      </div>

      <Section title="1. Referral / Reason">{encounter.referral_reason || <Empty />}</Section>
      <Section title="2. Subjective Assessment">{encounter.subjective_assessment?.notes || <Empty />}</Section>

      <Section title="3. Pain / Symptoms">
        {(encounter.pain_symptoms?.score !== null && encounter.pain_symptoms?.score !== undefined) || encounter.pain_symptoms?.location ? (
          <p>
            {encounter.pain_symptoms?.score !== null && encounter.pain_symptoms?.score !== undefined && (
              <span className="font-medium">Pain score: {encounter.pain_symptoms.score}/10</span>
            )}
            {encounter.pain_symptoms?.location && <span className="text-muted"> · {encounter.pain_symptoms.location}</span>}
          </p>
        ) : <Empty />}
      </Section>

      <Section title="4. Objective Assessment">{encounter.objective_assessment?.notes || <Empty />}</Section>

      <Section title="5. Functional Measurements">
        {hasFm ? (
          <div className="grid grid-cols-2 gap-3 text-sm text-ink">
            {fm.range_of_motion && <Field label="Range of Motion" value={fm.range_of_motion} />}
            {fm.strength && <Field label="Strength" value={fm.strength} />}
            {fm.mobility && <Field label="Mobility" value={fm.mobility} />}
            {fm.gait_balance && <Field label="Gait / Balance" value={fm.gait_balance} />}
          </div>
        ) : <Empty />}
      </Section>

      <Section title="6. Professional Assessment">{encounter.professional_assessment?.notes || <Empty />}</Section>

      <Section title="7. Intervention">
        {encounter.intervention?.performed?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {encounter.intervention.performed.map((opt: string) => (
              <span key={opt} className="text-xs px-3 py-1.5 rounded-full bg-teal-deep text-white">
                {opt.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
        {encounter.intervention?.notes || (!encounter.intervention?.performed?.length && <Empty />)}
      </Section>

      <Section title="8. Patient Response">{encounter.patient_response?.notes || <Empty />}</Section>

      <Section title="9. Progress">
        {encounter.progress?.status && (
          <span className="text-xs px-3 py-1.5 rounded-full bg-teal-deep text-white capitalize inline-block mb-2">
            {encounter.progress.status}
          </span>
        )}
        {encounter.progress?.notes || (!encounter.progress?.status && <Empty />)}
      </Section>

      <Section title="10. Home Program">{encounter.home_program?.notes || <Empty />}</Section>

      <Section title="11. Next Session">
        {encounter.follow_up_date && (
          <p className="text-sm text-ink font-medium mb-1">
            {new Date(encounter.follow_up_date).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        )}
        {encounter.next_session_plan || (!encounter.follow_up_date && <Empty />)}
      </Section>

      <Link
        href="/dashboard/bookings"
        className="block text-center border border-line rounded-lg py-2.5 text-sm font-medium text-muted hover:bg-page"
      >
        ← Back to Bookings
      </Link>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-ink mb-2">{title}</h3>
      <div className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Empty({ text = "Not recorded." }: { text?: string }) {
  return <span className="text-muted italic">{text}</span>;
}
