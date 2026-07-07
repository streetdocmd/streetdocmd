"use client";
import { useState } from "react";

export default function RecordCard({ booking, serviceLabel }: { booking: any; serviceLabel: string }) {
  const [open, setOpen] = useState(false);
  const visit = booking.visit;
  const prescription = visit?.prescription;
  const pdfUrl = prescription?.pdf_url;
  const drugs: { name?: string; drug_name?: string; dosage?: string; strength?: string; frequency?: string; duration?: string }[] = prescription?.drugs ?? [];

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
      >
        <div>
          <p className="font-semibold text-gray-900">{serviceLabel}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {booking.providers?.name} ·{" "}
            {booking.completed_at
              ? new Date(booking.completed_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })
              : "Date unknown"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-2.5 py-0.5 font-medium hover:bg-teal-100 transition-colors"
            >
              📄 Rx PDF
            </a>
          )}
          <span className="text-gray-400 text-sm">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && visit && (
        <div className="border-t border-gray-100 p-5 space-y-4 bg-gray-50/50">
          {visit.diagnosis && <Detail label="Diagnosis" value={visit.diagnosis} />}
          {visit.treatment && <Detail label="Treatment" value={visit.treatment} />}
          {visit.follow_up_plan && <Detail label="Follow-up Plan" value={visit.follow_up_plan} />}

          {drugs.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Medications Prescribed</p>
              <div className="space-y-1">
                {drugs.map((d, i) => (
                  <div key={i} className="text-sm text-gray-700">
                    <span className="font-medium">{d.name ?? d.drug_name}</span>
                    {(d.dosage ?? d.strength) && <span className="text-gray-500"> · {d.dosage ?? d.strength}</span>}
                    {d.frequency && <span className="text-gray-500"> · {d.frequency}</span>}
                    {d.duration && <span className="text-gray-500"> for {d.duration}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-blue-light text-blue-brand border border-blue-mid rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              📄 Download Prescription PDF
            </a>
          )}
        </div>
      )}

      {open && !visit && (
        <div className="border-t border-gray-100 p-5 text-sm text-gray-400">
          No clinical notes recorded for this visit.
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-gray-700 leading-relaxed">{value}</p>
    </div>
  );
}
