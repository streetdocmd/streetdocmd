"use client";
import { useState } from "react";
import Link from "next/link";
import { formatNaira, getEncounterRoute, type Profession } from "@streetdocmd/shared";

const STATUS_COLORS: Record<string, string> = {
  accepted:    "bg-accent-soft text-navy",
  en_route:    "bg-violet-100 text-violet-800",
  arrived:     "bg-indigo-100 text-indigo-800",
  in_progress: "bg-amber-100 text-amber-800",
  completed:   "bg-green-100 text-green-800",
  cancelled:   "bg-red-100 text-red-800",
};

export default function ProviderBookingCard({
  booking, profession, serviceLabel, statusLabel, isActive,
}: {
  booking: any;
  profession: Profession;
  serviceLabel: string;
  statusLabel: string;
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);

  const visit           = booking.visit;
  const encounter       = booking.encounter;
  const prescription    = visit?.prescription;
  const pdfUrl          = prescription?.pdf_url;
  const drugs: any[]    = prescription?.drugs ?? [];
  const isCompleted     = booking.status === "completed";
  const noteSubmitted   = encounter?.status === "submitted";

  return (
    <div className="card overflow-hidden">
      <div className="p-5 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-ink">{serviceLabel}</h3>
            <span className={`badge ${STATUS_COLORS[booking.status] ?? "bg-pending-bg text-muted"}`}>
              {statusLabel}
            </span>
            {pdfUrl && (
              <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-2 py-0.5 font-medium">
                Rx PDF
              </span>
            )}
          </div>
          <p className="text-sm text-muted mt-0.5 truncate">
            {booking.patients?.name ?? "Patient"} · {booking.patient_address}
          </p>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-teal-deep font-bold text-sm">{formatNaira(booking.net_payout)}</span>
            <span className="text-muted text-xs">
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
              className="text-xs text-teal-deep font-medium hover:underline"
            >
              {open ? "Hide notes ▲" : "View notes ▼"}
            </button>
          )}
        </div>
      </div>

      {open && isCompleted && (
        <div className="border-t border-line p-5 bg-page/50 space-y-4">
          {noteSubmitted ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-green-700">✓ Visit note submitted</p>
                {encounter.submitted_at && (
                  <p className="text-xs text-muted mt-0.5">
                    {new Date(encounter.submitted_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                )}
              </div>
              <Link
                href={getEncounterRoute(profession, booking.id)}
                className="text-sm text-teal-700 border border-teal-200 bg-teal-50 rounded-lg px-3 py-1.5 font-medium hover:bg-teal-100 transition-colors"
              >
                View note
              </Link>
            </div>
          ) : visit ? (
            <>
              {visit.diagnosis && (
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Diagnosis</p>
                  <p className="text-sm text-ink leading-relaxed">{visit.diagnosis}</p>
                </div>
              )}
              {visit.treatment && (
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Treatment</p>
                  <p className="text-sm text-ink leading-relaxed">{visit.treatment}</p>
                </div>
              )}
              {visit.follow_up_plan && (
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Follow up plan</p>
                  <p className="text-sm text-ink leading-relaxed">{visit.follow_up_plan}</p>
                </div>
              )}
              {drugs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Medications prescribed</p>
                  <div className="space-y-1">
                    {drugs.map((d: any, i: number) => (
                      <div key={i} className="text-sm text-ink">
                        <span className="font-medium">{d.name || d.drug_name}</span>
                        {(d.dosage || d.strength) && <span className="text-muted"> · {d.dosage || d.strength}</span>}
                        {d.frequency && <span className="text-muted"> · {d.frequency}</span>}
                        {d.duration && <span className="text-muted"> for {d.duration}</span>}
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
                  Download prescription PDF
                </a>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">No notes recorded for this visit.</p>
          )}
        </div>
      )}
    </div>
  );
}
