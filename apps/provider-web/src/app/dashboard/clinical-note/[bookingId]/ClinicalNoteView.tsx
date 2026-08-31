import Link from "next/link";

// Read-only display of an already-submitted clinical note — the doctor
// equivalent of NursingEncounterView/PhysioEncounterView. Submitted notes
// are locked (see SubmissionReview's own copy: "Once submitted, this note
// is locked and cannot be edited without admin approval").
export default function ClinicalNoteView({
  note, vitals, diagnoses, prescriptions, investigations, referrals, patient,
}: {
  note: any;
  vitals: any;
  diagnoses: any[];
  prescriptions: any[];
  investigations: any[];
  referrals: any[];
  patient: any;
}) {
  const attendance = note.people_in_attendance;
  const complaints: any[] = note.presenting_complaints ?? [];
  const chronic = note.chronic_issues;
  const history = note.history ?? {};
  const meds: any[] = note.current_medications_note ?? [];
  const social = note.social_history ?? {};
  const allergies: any[] = note.allergies_note ?? [];
  const genExam = note.general_examination;
  const systemic = note.systemic_examinations ?? {};
  const interventions = note.interventions ?? {};
  const rec = note.recommendations ?? {};

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Patient</p>
            <p className="font-semibold text-gray-900">{patient?.name ?? "Unknown Patient"}</p>
          </div>
          <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-3 py-1 font-medium">
            ✓ Submitted{note.submitted_at ? ` · ${new Date(note.submitted_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}` : ""}
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4 pb-10">
        <Section title="1. Patient Biodata & Attendance">
          {attendance?.selected?.length ? (
            <p>{attendance.selected.join(", ")}{attendance.other ? ` — ${attendance.other}` : ""}</p>
          ) : <Empty />}
        </Section>

        <Section title="2. Presenting Complaints">
          {complaints.length > 0 ? (
            <div className="space-y-2">
              {complaints.map((c, i) => (
                <p key={i}>{c.description}{c.duration_value ? ` (${c.duration_value} ${c.duration_unit ?? ""})` : ""}</p>
              ))}
            </div>
          ) : <Empty />}
        </Section>

        <Section title="3. Chronic Issues">
          {(chronic?.confirmed?.length || chronic?.added?.length) ? (
            <p>{[...(chronic.confirmed ?? []), ...(chronic.added ?? [])].join(", ")}</p>
          ) : <Empty />}
        </Section>

        <Section title="4. History">
          <KeyValueList
            data={history}
            labels={{
              presenting_complaint_history: "History of Presenting Complaint",
              past_medical: "Past Medical History",
              surgical: "Surgical History",
              family: "Family History",
              obstetric_gynaecological: "Obstetric/Gynaecological History",
              review_of_systems: "Review of Systems",
            }}
          />
        </Section>

        <Section title="5. Current Medications">
          {meds.length > 0 ? (
            <div className="space-y-1">
              {meds.map((m, i) => (
                <p key={i}>{m.name} — {m.dose} {m.frequency}{m.duration ? ` × ${m.duration}` : ""} {m.status ? `(${m.status})` : ""}</p>
              ))}
            </div>
          ) : <Empty />}
        </Section>

        <Section title="6. Social History">
          <KeyValueList
            data={social}
            labels={{
              smoking: "Smoking", pack_years: "Pack Years", alcohol: "Alcohol",
              occupation: "Occupation", marital_status: "Marital Status", living_situation: "Living Situation",
            }}
          />
        </Section>

        <Section title="7. Allergies">
          {allergies.length > 0 ? (
            <div className="space-y-1">
              {allergies.map((a, i) => <p key={i}>{a.allergen} — {a.reaction} ({a.status})</p>)}
            </div>
          ) : <Empty />}
        </Section>

        <Section title="8. General Examination">
          {genExam?.selected?.length ? (
            <p>{genExam.selected.join(", ")}{genExam.additional ? ` — ${genExam.additional}` : ""}</p>
          ) : <Empty />}
        </Section>

        <Section title="9. Vitals">
          {vitals ? (
            <div className="grid grid-cols-2 gap-3">
              {vitals.bp_systolic && <Field label="BP" value={`${vitals.bp_systolic}/${vitals.bp_diastolic} mmHg`} />}
              {vitals.pulse_rate && <Field label="Pulse Rate" value={`${vitals.pulse_rate} bpm${vitals.pulse_rhythm ? ` (${vitals.pulse_rhythm})` : ""}`} />}
              {vitals.temperature && <Field label="Temperature" value={`${vitals.temperature}°${vitals.temp_unit}`} />}
              {vitals.spo2 && <Field label="SpO2" value={`${vitals.spo2}%`} />}
              {vitals.respiratory_rate && <Field label="Respiratory Rate" value={vitals.respiratory_rate} />}
              {vitals.weight && <Field label="Weight" value={`${vitals.weight} kg`} />}
              {vitals.height && <Field label="Height" value={`${vitals.height} cm`} />}
            </div>
          ) : <Empty />}
        </Section>

        <Section title="10. Systemic Examination">
          {Object.keys(systemic).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(systemic).map(([system, fields]: [string, any]) => (
                <div key={system}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 capitalize">{system}</p>
                  <KeyValueList data={fields} />
                </div>
              ))}
            </div>
          ) : <Empty />}
        </Section>

        <Section title="11. Diagnosis">
          {diagnoses.length > 0 ? (
            <div className="space-y-2">
              {diagnoses.map((d, i) => (
                <p key={i}>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium mr-2 ${d.diagnosis_type === "primary" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {d.diagnosis_type ?? "primary"}
                  </span>
                  {d.clinical_description}{d.icd10_code && d.icd10_code !== "Uncodified" ? ` (${d.icd10_code})` : ""}
                  {d.plain_language_diagnosis && <span className="block text-xs text-gray-500 mt-0.5">{d.plain_language_diagnosis}</span>}
                </p>
              ))}
            </div>
          ) : <Empty />}
        </Section>

        <Section title="12. Interventions">
          <KeyValueList data={interventions} skip={["additional"]} />
          {interventions.additional && <p className="mt-2">{interventions.additional}</p>}
          {Object.keys(interventions).length === 0 && <Empty />}
        </Section>

        <Section title="13. Recommendations">
          <div className="space-y-2">
            {rec.lifestyle_advice && <p><span className="font-medium">Lifestyle:</span> {rec.lifestyle_advice}</p>}
            {rec.dietary_advice && <p><span className="font-medium">Diet:</span> {rec.dietary_advice}</p>}
            {rec.rest_advised && <p><span className="font-medium">Rest advised:</span> {rec.rest_days ? `${rec.rest_days} days` : "Yes"}</p>}
            {rec.additional && <p>{rec.additional}</p>}
            {!rec.lifestyle_advice && !rec.dietary_advice && !rec.rest_advised && !rec.additional && <Empty />}
          </div>

          {prescriptions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Prescriptions</p>
              {prescriptions.map((p, i) => (
                Array.isArray(p.drugs) ? p.drugs.map((d: any, j: number) => (
                  <p key={`${i}-${j}`}>• {d.name || d.drug_name} — {d.dosage || d.strength} {d.frequency}{d.duration ? ` × ${d.duration}` : ""}</p>
                )) : null
              ))}
            </div>
          )}

          {investigations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Investigations Ordered</p>
              {investigations.map((inv, i) => (
                Array.isArray(inv.tests) ? inv.tests.map((t: any, j: number) => (
                  <p key={`${i}-${j}`}>• {t.test_name} <span className="text-xs text-gray-400">({inv.status})</span></p>
                )) : null
              ))}
            </div>
          )}

          {referrals.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Hospital Referrals</p>
              {referrals.map((r, i) => (
                <p key={i}>• {r.hospital_partners?.name ?? "Hospital"} ({r.urgency}) — {r.status}</p>
              ))}
            </div>
          )}
        </Section>

        <Section title="14. Follow-up">
          {note.follow_up_date ? (
            <p>{new Date(note.follow_up_date).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}</p>
          ) : <Empty text="No follow-up scheduled." />}
        </Section>

        {note.safeguarding_flag && (
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

// Generic renderer for a flat object of short string/boolean values — used
// for sections whose per-field shape is numerous but simple (History,
// Social History, per-system examination findings, Interventions).
function KeyValueList({ data, labels, skip }: { data: Record<string, any>; labels?: Record<string, string>; skip?: string[] }) {
  const entries = Object.entries(data ?? {}).filter(([k, v]) => v && v !== "" && !skip?.includes(k));
  if (entries.length === 0) return <Empty />;
  return (
    <div className="space-y-1.5">
      {entries.map(([k, v]) => (
        <p key={k}>
          <span className="text-gray-500">{labels?.[k] ?? k.replace(/_/g, " ")}:</span>{" "}
          <span className="font-medium">{typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}</span>
        </p>
      ))}
    </div>
  );
}
