"use client";
import { useState } from "react";
import { FileText, ChevronDown, ChevronUp, AlertTriangle, FlaskConical, Download, ClipboardList } from "lucide-react";

export default function RecordCard({ booking, serviceLabel }: { booking: any; serviceLabel: string }) {
  const [open, setOpen] = useState(false);

  // summary = rich patient-friendly data from clinical note (new path)
  // visit   = basic data from old complete-visit flow
  const summary = booking.summary;
  const visit = booking.visit;
  const pdfUrl = visit?.prescription?.pdf_url ?? visit?.prescription_url ?? null;
  const hasContent = !!(summary || visit);

  const previewDiagnosis = summary?.plain_diagnosis ?? visit?.diagnosis ?? null;

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-page transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
          <div className="w-10 h-10 rounded-lg bg-accent-soft flex items-center justify-center shrink-0">
            <ClipboardList size={18} className="text-accent" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-ink">{serviceLabel}</p>
            <p className="text-sm text-muted mt-0.5">
              {booking.providers?.name} ·{" "}
              {booking.completed_at
                ? new Date(booking.completed_at).toLocaleDateString("en-NG", {
                    day: "numeric", month: "long", year: "numeric",
                  })
                : "Date unknown"}
            </p>
            {!open && previewDiagnosis && (
              <p className="text-sm text-teal-700 font-medium mt-1 truncate">{previewDiagnosis}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pdfUrl && !open && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-2.5 py-0.5 font-medium hover:bg-teal-100 transition-colors"
            >
              <FileText size={12} /> Rx
            </a>
          )}
          {open ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-line bg-page/50">
          {summary ? (
            <SummaryView summary={summary} pdfUrl={pdfUrl} />
          ) : visit ? (
            <LegacyView visit={visit} pdfUrl={pdfUrl} />
          ) : (
            <p className="p-5 text-sm text-muted">
              Notes for this visit are still being prepared.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Rich summary from the new clinical note system ────────────────────────────
// Patient-safe: only shows plain language fields from visit_summaries.
// Never shows ICD-10 codes, examination findings, clinical reasoning,
// safeguarding flags, or any field from clinical_notes directly.
function SummaryView({ summary, pdfUrl }: { summary: any; pdfUrl?: string | null }) {
  const medications: any[] = summary.medications ?? [];
  const investigations: any[] = summary.investigations ?? [];
  const abnormal: any[] = summary.abnormal_vitals ?? [];
  const diagnoses: string[] = (summary.plain_diagnosis ?? "")
    .split(",")
    .map((d: string) => d.trim())
    .filter(Boolean);

  return (
    <div className="p-5 space-y-4">
      {summary.reason_for_visit && (
        <Field label="Why we visited" value={summary.reason_for_visit} />
      )}

      {diagnoses.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
            {diagnoses.length > 1 ? "Diagnoses" : "Diagnosis"}
          </p>
          <div className="space-y-0.5">
            {diagnoses.map((d, i) => (
              <p key={i} className="text-sm font-semibold text-ink">{d}</p>
            ))}
          </div>
        </div>
      )}

      {abnormal.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Important Readings</p>
          {abnormal.map((v: any, i: number) => (
            <div key={i}>
              <p className="text-sm font-medium text-amber-800 inline-flex items-center gap-1.5">
                <AlertTriangle size={14} /> {v.vital}: {v.value}
              </p>
              {v.message && <p className="text-xs text-amber-700 mt-0.5 ml-4">{v.message}</p>}
            </div>
          ))}
        </div>
      )}

      {summary.what_was_done && (
        <Field label="What happened during your visit" value={summary.what_was_done} />
      )}

      {medications.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Medications</p>
          <div className="space-y-2">
            {medications.map((m: any, i: number) => (
              <div key={i} className="bg-white border border-line rounded-lg p-3">
                <p className="text-sm font-semibold text-ink">{m.name}</p>
                {m.how_to_take && <p className="text-sm text-muted mt-0.5">{m.how_to_take}</p>}
                {m.duration && <p className="text-xs text-muted mt-0.5">Duration: {m.duration}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {investigations.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Tests Ordered</p>
          <div className="space-y-1">
            {investigations.map((inv: any, i: number) => (
              <p key={i} className="text-sm text-ink inline-flex items-center gap-1.5">
                <FlaskConical size={14} className="text-muted" /> {inv.test_name}
                {inv.expected_timeline && <span className="text-muted"> · {inv.expected_timeline}</span>}
              </p>
            ))}
          </div>
        </div>
      )}

      {summary.recommendations && (
        <Field label="What to do next" value={summary.recommendations} />
      )}

      {summary.follow_up_date && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Follow up appointment</p>
          <p className="text-sm font-semibold text-green-800">
            {new Date(summary.follow_up_date).toLocaleDateString("en-NG", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </p>
        </div>
      )}

      {pdfUrl && (
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-accent border border-accent/30 bg-accent-soft rounded-lg px-4 py-2 hover:bg-accent-soft transition-colors font-medium">
          <Download size={15} /> Download Prescription PDF
        </a>
      )}
    </div>
  );
}

// ── Basic view from the old complete-visit flow ───────────────────────────────
function LegacyView({ visit, pdfUrl }: { visit: any; pdfUrl?: string | null }) {
  const drugs: any[] = visit?.prescription?.drugs ?? [];

  return (
    <div className="p-5 space-y-4">
      {visit.diagnosis && <Field label="Diagnosis" value={visit.diagnosis} />}
      {visit.treatment && <Field label="Treatment" value={visit.treatment} />}
      {visit.follow_up_plan && <Field label="Follow up plan" value={visit.follow_up_plan} />}

      {drugs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Medications Prescribed</p>
          <div className="space-y-1">
            {drugs.map((d: any, i: number) => (
              <div key={i} className="text-sm text-ink">
                <span className="font-medium">{d.name ?? d.drug_name}</span>
                {(d.dosage ?? d.strength) && <span className="text-muted"> · {d.dosage ?? d.strength}</span>}
                {d.frequency && <span className="text-muted"> · {d.frequency}</span>}
                {d.duration && <span className="text-muted"> for {d.duration}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {pdfUrl && (
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-accent border border-accent/30 bg-accent-soft rounded-lg px-4 py-2 hover:bg-accent-soft transition-colors font-medium">
          <Download size={15} /> Download Prescription PDF
        </a>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-ink leading-relaxed">{value}</p>
    </div>
  );
}
