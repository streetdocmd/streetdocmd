"use client";

import { useId, useState } from "react";
import { FileText } from "lucide-react";
import type { LegalDocument } from "@/lib/legal";
import LegalDocumentModal from "./LegalDocumentModal";

/**
 * The Platform Acceptance Screen control: a clearly labelled link to the full
 * Agreement (opens it in a modal) and an UNCHECKED-by-default box carrying the
 * document's exact acceptance wording. Controlled — the parent owns `checked`
 * and keeps its submit button disabled until it's true.
 */
export default function AgreementCheckbox({
  doc, checked, onChange, disabled = false, linkLabel, error,
}: {
  doc: LegalDocument;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Defaults to "Read the <document title>". */
  linkLabel?: string;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-blue-brand hover:text-blue-700 hover:underline text-left"
      >
        <FileText size={16} className="shrink-0" aria-hidden />
        {linkLabel ?? `Read the ${doc.title}`}
      </button>

      <div className={`flex items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors ${
        checked ? "border-blue-mid bg-blue-light/60" : error ? "border-red-300 bg-red-50/40" : "border-gray-200 bg-white"
      }`}>
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 w-4 h-4 shrink-0 rounded border-gray-300 accent-blue-brand cursor-pointer disabled:cursor-not-allowed"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <label htmlFor={id} className="text-sm text-gray-800 leading-relaxed cursor-pointer">
          {doc.acceptanceLabels[0]}
        </label>
      </div>
      {error && <p id={`${id}-error`} className="text-xs text-red-600">{error}</p>}

      <LegalDocumentModal doc={doc} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
