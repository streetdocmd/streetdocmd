"use client";
import { useState } from "react";
import { PATIENT_TERMS, PRIVACY_POLICY, type LegalDocument } from "@/lib/legal";
import { TERMS_ACCEPTANCE_LABEL, PRIVACY_ACKNOWLEDGEMENT_LABEL } from "@/lib/legal-acceptance";
import LegalDocumentModal from "./LegalDocumentModal";

export type LegalAcceptanceValue = { terms: boolean; privacy: boolean };

// The two separate, unchecked-by-default controls the Patient Terms (cl. 1.1,
// 20) and Privacy Policy (s.7) require. Used at registration and when an
// existing patient is asked to accept a new version. Each box uses the exact
// wording from the documents and has its own "Read" link to the full text.
// The parent owns the values and must start them both at false.
export default function LegalAcceptanceFields({
  value,
  onChange,
  showErrors = false,
  idPrefix = "legal",
}: {
  value: LegalAcceptanceValue;
  onChange: (next: LegalAcceptanceValue) => void;
  showErrors?: boolean;
  idPrefix?: string;
}) {
  const [openDoc, setOpenDoc] = useState<LegalDocument | null>(null);

  return (
    <fieldset className="space-y-2.5">
      <legend className="sr-only">Terms of Service and Privacy Policy</legend>
      <Row
        id={`${idPrefix}-terms`}
        checked={value.terms}
        onToggle={checked => onChange({ ...value, terms: checked })}
        label={TERMS_ACCEPTANCE_LABEL}
        onRead={() => setOpenDoc(PATIENT_TERMS)}
        readLabel="Read the Terms of Service"
        error={showErrors && !value.terms ? "Please agree to the Terms of Service to continue." : undefined}
      />
      <Row
        id={`${idPrefix}-privacy`}
        checked={value.privacy}
        onToggle={checked => onChange({ ...value, privacy: checked })}
        label={PRIVACY_ACKNOWLEDGEMENT_LABEL}
        onRead={() => setOpenDoc(PRIVACY_POLICY)}
        readLabel="Read the Privacy Policy"
        error={showErrors && !value.privacy ? "Please acknowledge the Privacy Policy to continue." : undefined}
      />

      {openDoc && <LegalDocumentModal doc={openDoc} isOpen onClose={() => setOpenDoc(null)} />}
    </fieldset>
  );
}

function Row({
  id, checked, onToggle, label, onRead, readLabel, error,
}: {
  id: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  label: string;
  onRead: () => void;
  readLabel: string;
  error?: string;
}) {
  return (
    <div>
      <div
        className={`flex items-start gap-3 rounded-xl border p-3.5 transition-colors ${
          error ? "border-red-200 bg-red-50/60" : checked ? "border-blue-mid bg-blue-light" : "border-gray-200 bg-white"
        }`}
      >
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={e => onToggle(e.target.checked)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer rounded border-gray-300 text-blue-brand focus:ring-blue-brand"
        />
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="cursor-pointer text-sm leading-relaxed text-gray-900">
            {label}
          </label>
          <button
            type="button"
            onClick={onRead}
            aria-label={readLabel}
            className="mt-1 block text-xs font-semibold text-blue-brand hover:underline"
          >
            Read →
          </button>
        </div>
        <span className="mt-0.5 shrink-0 text-[10px] font-semibold tracking-wide text-gray-400">REQUIRED</span>
      </div>
      {error && <p id={`${id}-error`} className="mt-1 px-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
