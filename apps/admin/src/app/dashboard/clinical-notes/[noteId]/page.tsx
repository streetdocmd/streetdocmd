import { notFound } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase-server";
import Link from "next/link";

export default async function ClinicalNoteDetailPage({ params }: { params: { noteId: string } }) {
  const admin = createAdminSupabase();

  const { data: note } = await admin
    .from("clinical_notes")
    .select(`
      *,
      providers(name, credentials, specialty),
      patient:users!patient_id(id, name, dob, gender, blood_group)
    `)
    .eq("id", params.noteId)
    .single();

  if (!note) notFound();

  const { data: vitals } = await admin.from("vitals").select("*").eq("clinical_note_id", params.noteId).maybeSingle();
  const { data: diagnoses } = await admin.from("clinical_note_diagnoses").select("*").eq("clinical_note_id", params.noteId);

  const patient = note.patient as any;
  const provider = note.providers as any;

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">{title}</h3>
        {children}
      </div>
    );
  }

  function Field({ label, value }: { label: string; value?: string | null }) {
    return (
      <div>
        <p className="text-xs text-gray-400 font-medium uppercase">{label}</p>
        <p className="text-sm text-gray-800 mt-0.5">{value ?? "—"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/dashboard/clinical-notes" className="text-sm text-gray-500 hover:underline">← Clinical Notes</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">Clinical Note — Read Only</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {note.safeguarding_flag && (
            <span className="bg-red-100 text-red-700 border border-red-200 rounded-lg px-3 py-1.5 text-sm font-semibold">🔴 Safeguarding Flagged</span>
          )}
          <span className={`rounded-lg px-3 py-1.5 text-sm font-medium ${note.status === "submitted" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
            {note.status === "submitted" ? "✓ Submitted" : "Draft"}
          </span>
        </div>
      </div>

      {note.safeguarding_flag && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
          <p className="text-red-800 font-semibold">⚠ Safeguarding concern was flagged during this visit.</p>
          <p className="text-red-600 text-sm mt-0.5">This information is confidential and must not be shared with the patient.</p>
        </div>
      )}

      {/* Provider & Patient */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Section title="Provider">
          <Field label="Name" value={provider?.name} />
          <Field label="Credentials" value={provider?.credentials} />
          <Field label="Specialty" value={provider?.specialty} />
        </Section>
        <Section title="Patient (Anonymised)">
          <Field label="Patient ID" value={patient?.id ? `PT-${patient.id.slice(0, 6).toUpperCase()}` : "—"} />
          <Field label="Gender" value={patient?.gender} />
          <Field label="Blood Group" value={patient?.blood_group} />
        </Section>
      </div>

      {/* Presenting Complaints */}
      {note.presenting_complaints && (
        <Section title="Presenting Complaints">
          {(note.presenting_complaints as any[]).map((c: any, i: number) => (
            <div key={i} className="flex gap-3 text-sm">
              <span className="text-gray-400 font-medium">{i + 1}.</span>
              <span className="text-gray-800">{c.description} <span className="text-gray-400">({c.duration_value} {c.duration_unit})</span></span>
            </div>
          ))}
        </Section>
      )}

      {/* Diagnoses */}
      {(diagnoses?.length ?? 0) > 0 && (
        <Section title="Diagnoses">
          {diagnoses!.map((d: any, i: number) => (
            <div key={i} className="flex items-start gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${d.diagnosis_type === "primary" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                {d.diagnosis_type}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-800">{d.clinical_description}</p>
                <p className="text-xs text-gray-500">{d.icd10_code} · Patient sees: "{d.plain_language_diagnosis}"</p>
                {d.is_uncodified && <span className="text-xs bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">Uncodified</span>}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Vitals */}
      {vitals && (
        <Section title="Vitals">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vitals.bp_systolic && <Field label="Blood Pressure" value={`${vitals.bp_systolic}/${vitals.bp_diastolic} mmHg`} />}
            {vitals.pulse_rate && <Field label="Pulse Rate" value={`${vitals.pulse_rate} bpm (${vitals.pulse_rhythm ?? "—"})`} />}
            {vitals.temperature && <Field label="Temperature" value={`${vitals.temperature}°${vitals.temp_unit}`} />}
            {vitals.spo2 && <Field label="SpO₂" value={`${vitals.spo2}%`} />}
            {vitals.respiratory_rate && <Field label="Resp. Rate" value={`${vitals.respiratory_rate} /min`} />}
            {vitals.weight && <Field label="Weight" value={`${vitals.weight} kg`} />}
          </div>
        </Section>
      )}

      {/* History */}
      {note.history && (
        <Section title="History">
          {Object.entries(note.history as Record<string, string>).filter(([, v]) => v).map(([k, v]) => (
            <Field key={k} label={k.replace(/_/g, " ")} value={v} />
          ))}
        </Section>
      )}

      {/* General Examination */}
      {note.general_examination && (
        <Section title="General Examination">
          {(note.general_examination as any).selected?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {((note.general_examination as any).selected as string[]).map((f: string) => (
                <span key={f} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2.5 py-1">{f}</span>
              ))}
            </div>
          )}
          {(note.general_examination as any).additional && <Field label="Additional Findings" value={(note.general_examination as any).additional} />}
        </Section>
      )}

      {/* Interventions */}
      {note.interventions && (
        <Section title="Interventions">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(note.interventions as Record<string, any>)
              .filter(([k, v]) => v && k !== "additional" && !k.endsWith("_spec") && !k.endsWith("_result"))
              .map(([k]) => (
                <span key={k} className="text-xs bg-gray-100 text-gray-700 rounded-full px-2.5 py-1">{k.replace(/_/g, " ")}</span>
              ))}
          </div>
          {(note.interventions as any).additional && <Field label="Additional" value={(note.interventions as any).additional} />}
        </Section>
      )}

      {/* Recommendations */}
      {note.recommendations && (
        <Section title="Recommendations">
          {Object.entries(note.recommendations as Record<string, any>).filter(([, v]) => v).map(([k, v]) => (
            <Field key={k} label={k.replace(/_/g, " ")} value={String(v)} />
          ))}
        </Section>
      )}

      {/* Follow-up */}
      {note.follow_up_date && (
        <Section title="Follow-up">
          <Field label="Scheduled Date" value={new Date(note.follow_up_date).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />
        </Section>
      )}

      <div className="text-xs text-gray-400 text-center py-4">
        Submitted {note.submitted_at ? new Date(note.submitted_at).toLocaleString("en-NG") : "—"} · Note ID: {params.noteId}
      </div>
    </div>
  );
}
