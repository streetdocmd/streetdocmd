"use client";
import { useState } from "react";
import { PATIENT_TERMS, PRIVACY_POLICY } from "@/lib/legal";
import LegalDocumentModal from "./LegalDocumentModal";

// Self-contained trigger that opens a full legal document in a modal, for
// server-component pages (Profile) that can't hold open/close state.
// Takes the slug rather than the document so server components don't have
// to pass the whole document across the client boundary.
const PATIENT_DOCS = { "patient-terms": PATIENT_TERMS, "privacy-policy": PRIVACY_POLICY } as const;

export default function LegalDocumentLink({
  slug,
  children,
  className,
}: {
  slug: keyof typeof PATIENT_DOCS;
  children?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const doc = PATIENT_DOCS[slug];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? "text-sm font-medium text-accent hover:underline"}
      >
        {children ?? doc.title}
      </button>
      <LegalDocumentModal doc={doc} isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
