"use client";
import { useState } from "react";
import { ChevronRight, FileText } from "lucide-react";
import ProviderAgreementModal from "@/components/ProviderAgreementModal";
import { cx, focusRing } from "@/components/ds";

// Account row that opens the Provider Agreement in a modal
export default function AgreementLink() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={cx("flex w-full items-center gap-3 border-b border-line py-3.5 text-left last:border-b-0", focusRing)}>
        <span className="grid h-10 w-10 flex-none place-items-center rounded-[13px] bg-teal-soft text-teal-deep"><FileText size={18} aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <b className="block text-ds-sm text-ink">Provider Agreement</b>
          <small className="text-ds-xs text-muted">Your responsibilities</small>
        </span>
        <ChevronRight size={20} className="text-muted" aria-hidden />
      </button>
      <ProviderAgreementModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
