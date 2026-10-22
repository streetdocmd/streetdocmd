import LegalDocumentView, { legalMetadata } from "@/components/LegalDocumentView";
import { PROVIDER_AGREEMENT } from "@/lib/legal";

export const metadata = legalMetadata(
  PROVIDER_AGREEMENT,
  "Provider Service Agreement",
  "Independent contractor terms for doctors, nurses and physiotherapists who provide care through the StreetdocMD platform.",
);

export default function Page() {
  return <LegalDocumentView doc={PROVIDER_AGREEMENT} />;
}
