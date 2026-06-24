"use client";
import { useState } from "react";

export default function RecordCard({ booking, serviceLabel }: { booking: any; serviceLabel: string }) {
  const [open, setOpen] = useState(false);
  const visit = booking.visits?.[0];

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
        <span className="text-gray-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {open && visit && (
        <div className="border-t border-gray-100 p-5 space-y-4 bg-gray-50/50">
          {visit.diagnosis && <Detail label="Diagnosis" value={visit.diagnosis} />}
          {visit.treatment && <Detail label="Treatment" value={visit.treatment} />}
          {visit.follow_up_plan && <Detail label="Follow-up Plan" value={visit.follow_up_plan} />}
          {visit.prescription_url && (
            <a
              href={visit.prescription_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-blue-light text-blue-brand border border-blue-mid rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              📄 View Prescription PDF
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