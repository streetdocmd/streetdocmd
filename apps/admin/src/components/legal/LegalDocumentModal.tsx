"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ExternalLink, FileText, X } from "lucide-react";
import { LEGAL_PATHS, legalUrl, type LegalDocument } from "@/lib/legal";
import LegalDocumentView from "./LegalDocumentView";

/**
 * Full-screen-on-mobile dialog showing a complete legal document. Escape,
 * the close button or a backdrop click closes it. `footer` replaces the
 * default footer actions (the public-copy link always stays).
 */
export default function LegalDocumentModal({
  doc, open, onClose, footer,
}: {
  doc: LegalDocument;
  open: boolean;
  onClose: () => void;
  footer?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = `legal-modal-${doc.slug}`;
  // Kept in a ref so an inline onClose doesn't re-run the open/focus effect on every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-stretch sm:items-center justify-center sm:p-6 bg-ink/50 backdrop-blur-[1px]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-white w-full sm:max-w-3xl h-full sm:h-auto sm:max-h-[88vh] flex flex-col sm:rounded-xl shadow-xl outline-none"
      >
        <div className="flex items-start gap-3 px-5 sm:px-6 py-4 border-b border-line">
          <span className="hidden sm:flex w-9 h-9 rounded-lg bg-accent-soft text-accent items-center justify-center shrink-0">
            <FileText size={18} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-ink">{doc.title}</h2>
            <p className="text-xs text-muted mt-0.5">Version {doc.version} · {doc.versionLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 -mr-1 rounded-md text-muted hover:text-ink hover:bg-pending-bg"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5">
          <LegalDocumentView doc={doc} />
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between px-5 sm:px-6 py-3 border-t border-line bg-page/70 sm:rounded-b-xl">
          <a
            href={legalUrl(doc.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-accent hover:text-accent hover:underline"
          >
            Open public copy (streetdocmd.com{LEGAL_PATHS[doc.slug]}) <ExternalLink size={13} aria-hidden />
          </a>
          {footer ?? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 bg-accent text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-accent-hover transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
