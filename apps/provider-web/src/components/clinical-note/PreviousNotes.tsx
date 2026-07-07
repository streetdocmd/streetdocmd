"use client";
import { useState } from "react";

export default function PreviousNotes({ notes }: { notes: any[] }) {
  const [expanded, setExpanded] = useState(true);
  const [modalNote, setModalNote] = useState<any | null>(null);

  return (
    <>
      <div className="border border-amber-200 bg-amber-50 rounded-xl overflow-hidden mb-4">
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-amber-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-amber-600">📋</span>
            <span className="font-semibold text-amber-800">Previous Visits ({notes.length})</span>
            <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">Patient sharing enabled</span>
          </div>
          <span className="text-amber-600">{expanded ? "▲" : "▼"}</span>
        </button>

        {expanded && (
          <div className="divide-y divide-amber-100">
            {notes.map((note, i) => {
              const primaryDx = note.clinical_note_diagnoses?.find((d: any) => d.diagnosis_type === "primary");
              const date = note.submitted_at ? new Date(note.submitted_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "Unknown";
              const bp = note.vitals?.[0];
              return (
                <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{date}</p>
                    <p className="text-xs text-gray-500">{primaryDx?.plain_language_diagnosis ?? primaryDx?.clinical_description ?? "No diagnosis"}</p>
                    {bp && <p className="text-xs text-gray-400">BP: {bp.bp_systolic}/{bp.bp_diastolic} · PR: {bp.pulse_rate}</p>}
                  </div>
                  <button
                    onClick={() => setModalNote(note)}
                    className="text-xs text-blue-600 hover:underline whitespace-nowrap font-medium"
                  >View Full Note →</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalNote && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Previous Clinical Note</h3>
              <button onClick={() => setModalNote(null)} className="text-gray-400 hover:text-gray-600 text-xl font-light">✕</button>
            </div>
            <div className="p-4 space-y-4">
              {modalNote.safeguarding_flag && (
                <div className="bg-red-50 border border-red-300 rounded-xl p-3">
                  <p className="text-sm text-red-700 font-semibold">⚠ Safeguarding concern was flagged during this visit.</p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Provider</p>
                <p className="text-sm text-gray-800">{modalNote.providers?.name} {modalNote.providers?.credentials}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Date</p>
                <p className="text-sm text-gray-800">{modalNote.submitted_at ? new Date(modalNote.submitted_at).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Unknown"}</p>
              </div>

              {modalNote.presenting_complaints && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Presenting Complaints</p>
                  {(modalNote.presenting_complaints as any[]).map((c: any, i: number) => (
                    <p key={i} className="text-sm text-gray-700">• {c.description} ({c.duration_value} {c.duration_unit})</p>
                  ))}
                </div>
              )}

              {modalNote.clinical_note_diagnoses?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Diagnoses</p>
                  {modalNote.clinical_note_diagnoses.map((d: any, i: number) => (
                    <p key={i} className="text-sm text-gray-700">• {d.clinical_description} <span className="text-gray-400">({d.icd10_code})</span></p>
                  ))}
                </div>
              )}

              {modalNote.vitals?.[0] && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Vitals</p>
                  <p className="text-sm text-gray-700">BP: {modalNote.vitals[0].bp_systolic}/{modalNote.vitals[0].bp_diastolic} mmHg · PR: {modalNote.vitals[0].pulse_rate} bpm</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
