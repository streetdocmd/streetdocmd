"use client";

import { useState } from "react";
import { CheckCircle2, Clock, ExternalLink, Eye, ScrollText } from "lucide-react";
import { FACILITY_AGREEMENT, legalUrl } from "@/lib/legal";
import { agreementState, formatAcceptedAt } from "@/lib/facility-agreement";
import { ui } from "@/components/portal/ui";
import LegalDocumentModal from "./LegalDocumentModal";

/**
 * The facility's copy of its accepted terms: what was accepted, when and by
 * whom, with the full Agreement one click away (cl. 2.8).
 */
export default function FacilityAgreementRecord({
  version, acceptedAt, acceptedName, className = "",
}: {
  version: string | null;
  acceptedAt: string | null;
  acceptedName: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const state = agreementState({ version, acceptedAt });

  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="flex items-start gap-3 min-w-0">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          state === "accepted" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
        }`}>
          {state === "accepted" ? <CheckCircle2 size={18} aria-hidden /> : state === "outdated" ? <Clock size={18} aria-hidden /> : <ScrollText size={18} aria-hidden />}
        </span>
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-ink">
            Facility Partner Agreement — Version {state === "missing" ? FACILITY_AGREEMENT.version : version}
          </p>
          {state === "missing" ? (
            <p className="text-muted mt-0.5">Not yet accepted. An authorised representative needs to review and accept it.</p>
          ) : (
            <p className="text-muted mt-0.5">
              Accepted on {formatAcceptedAt(acceptedAt)}{acceptedName ? <> by <strong className="text-ink">{acceptedName}</strong></> : null}
              {state === "outdated" && <span className="block text-amber-700 mt-0.5">Version {FACILITY_AGREEMENT.version} is now current — please review and accept it.</span>}
            </p>
          )}
          <a
            href={legalUrl("facility-agreement")}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            Public copy on streetdocmd.com <ExternalLink size={11} aria-hidden />
          </a>
        </div>
      </div>
      <button type="button" onClick={() => setOpen(true)} className={`${ui.btnSecondary} shrink-0 self-start sm:self-center`}>
        <Eye size={15} aria-hidden /> View
      </button>
      <LegalDocumentModal doc={FACILITY_AGREEMENT} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
