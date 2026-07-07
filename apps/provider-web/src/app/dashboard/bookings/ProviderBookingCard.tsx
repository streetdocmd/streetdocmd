"use client";
import { useState } from "react";
import Link from "next/link";
import { formatNaira } from "@streetdocmd/shared";

const STATUS_COLORS: Record<string, string> = {
  accepted:    "bg-blue-100 text-blue-800",
  en_route:    "bg-violet-100 text-violet-800",
  arrived:     "bg-indigo-100 text-indigo-800",
  in_progress: "bg-amber-100 text-amber-800",
  completed:   "bg-green-100 text-green-800",
  cancelled:   "bg-red-100 text-red-800",
};

export default function ProviderBookingCard({
  booking, serviceLabel, statusLabel, isActive,
}: {
  booking: any;
  serviceLabel: string;
  statusLabel: string;
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);

  const visit        = booking.visit;
  const prescription = visit?.prescription;
  const pdfUrl       = prescription?.pdf_url;
  const drugs: any[] = prescription?.drugs ?? [];
  const isCompleted  = booking.status === "completed";

  return (
    <div className="card overflow-hidden">
      <div className="p-5 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{serviceLabel}</h3>
            <span className={`badge ${STATUS_COLORS[booking.status] ?? "bg-gray-100 text-gray-600"}`}>
              {statusLabel}
            </span>
            {pdfUrl && (
              <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-2 py-0.5 font-medium">
                Rx PDF
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5 truncate">
            {booking.patients?.name ?? "Patient"} · {booking.patient_address}
          </p>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-teal-brand font-bold text-sm">{formatNaira(booking.net_payout)}</span>
            <span className="text-gray-400 text-xs">
              {new Date(booking.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 items-end shrink-0">
          {isActive && (
            <Link href={`/dashboard/active/${booking.id}`} className="btn-teal text-xs px-3 py-1.5">
              Continue →
            </Link>
          )}
          {isCompleted && (
            <button
              onClick={() => setOpen(o => !o)}
              className="text-xs text-teal-brand font-medium hover:underline"
            >
              {open ? "Hide notes ▲" : "View notes ▼"}
            </button>
          )}
        </div>
      </div>

      {open && isCompleted && (
        <div className="border-t border-gray-100 p-5 bg-gray-50/50 space-y-4">
          {visit ? (
            <>
              {visit.diagnosis && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Diagnosis</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{visit.diagnosis}</p>
                </div>
              )}
              {visit.treatment && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Treatment</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{visit.treatment}</p>
                </div>
              )}
              {visit.follow_up_plan && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Follow-up Plan</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{visit.follow_up_plan}</p>
                </div>
              )}

              {drugs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Medications Prescribed</p>
                  <div className="space-y-1">
                    {drugs.map((d: any, i: number) => (
                      <div key={i} className="text-sm text-gray-700">
                        <span className="font-medium">{d.name || d.drug_name}</span>
                        {(d.dosage || d.strength) && <span className="text-gray-500"> · {d.dosage || d.strength}</span>}
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
                  className="inline-flex items-center gap-2 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg px-4 py-2 text-sm font-medium hover:bg-teal-100 transition-colors"
                >
                  📄 Download Prescription PDF
                </a>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">No clinical notes recorded for this visit.</p>
          )}
        </div>
      )}
    </div>
  );
}
