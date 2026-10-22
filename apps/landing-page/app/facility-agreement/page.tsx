import LegalDocumentView, { legalMetadata } from "@/components/LegalDocumentView";
import { FACILITY_AGREEMENT } from "@/lib/legal";

export const metadata = legalMetadata(
  FACILITY_AGREEMENT,
  "Facility Partner Agreement",
  "Platform terms between STREETDOC MD LTD and the laboratories, pharmacies and hospitals that partner with StreetdocMD.",
);

export default function Page() {
  return <LegalDocumentView doc={FACILITY_AGREEMENT} />;
}
