"use client";
import { useState } from "react";
import { PATIENT_TERMS, PRIVACY_POLICY, type LegalDocument } from "@/lib/legal";
import { TERMS_ACCEPTANCE_LABEL, PRIVACY_ACKNOWLEDGEMENT_LABEL } from "@/lib/legal-acceptance";
import { CheckboxRow } from "@/components/ds";
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
    <fieldset>
      <legend className="sr-only">Terms of Service and Privacy Policy</legend>
      <CheckboxRow
        id={`${idPrefix}-terms`}
        checked={value.terms}
        onChange={checked => onChange({ ...value, terms: checked })}
        onRead={() => setOpenDoc(PATIENT_TERMS)}
        readAriaLabel="Read the Terms of Service"
        error={showErrors && !value.terms ? "Please agree to the Terms of Service to continue." : undefined}
      >
        {TERMS_ACCEPTANCE_LABEL}
      </CheckboxRow>
      <CheckboxRow
        id={`${idPrefix}-privacy`}
        checked={value.privacy}
        onChange={checked => onChange({ ...value, privacy: checked })}
        onRead={() => setOpenDoc(PRIVACY_POLICY)}
        readAriaLabel="Read the Privacy Policy"
        error={showErrors && !value.privacy ? "Please acknowledge the Privacy Policy to continue." : undefined}
      >
        {PRIVACY_ACKNOWLEDGEMENT_LABEL}
      </CheckboxRow>

      {openDoc && <LegalDocumentModal doc={openDoc} isOpen onClose={() => setOpenDoc(null)} />}
    </fieldset>
  );
}
