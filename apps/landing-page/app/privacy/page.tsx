import LegalDocumentView, { legalMetadata } from "@/components/LegalDocumentView";
import { PRIVACY_POLICY } from "@/lib/legal";

export const metadata = legalMetadata(
  PRIVACY_POLICY,
  "Privacy Policy",
  "How STREETDOC MD LTD collects, uses, shares and protects personal and health information on the StreetdocMD platform, and how patient consent works.",
);

export default function Page() {
  return <LegalDocumentView doc={PRIVACY_POLICY} />;
}
