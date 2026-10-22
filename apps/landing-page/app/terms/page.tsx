import LegalDocumentView, { legalMetadata } from "@/components/LegalDocumentView";
import { PATIENT_TERMS } from "@/lib/legal";

export const metadata = legalMetadata(
  PATIENT_TERMS,
  "Patient Terms of Service",
  "The terms that apply when patients and caregivers use StreetdocMD to book home-based medical, nursing and physiotherapy care in Nigeria.",
);

export default function Page() {
  return <LegalDocumentView doc={PATIENT_TERMS} />;
}
