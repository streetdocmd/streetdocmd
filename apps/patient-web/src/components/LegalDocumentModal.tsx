"use client";
import { useEffect, useRef } from "react";
import { ExternalLink, X } from "lucide-react";
import { legalUrl, type LegalBlock, type LegalDocument } from "@/lib/legal";
import { Button, iconButtonClass } from "@/components/ds";

// Renders a full StreetdocMD legal document (Terms of Service, Privacy
// Policy) from the approved data in @/lib/legal — never retype legal text
// here. Purely informational: opening or closing it never grants, accepts
// or acknowledges anything; callers own the acceptance controls.
export default function LegalDocumentModal({
  doc,
  isOpen,
  onClose,
}: {
  doc: LegalDocument;
  isOpen: boolean;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Capture phase + stopPropagation: when opened over another dialog
    // (e.g. the re-acceptance prompt), Escape closes only this one.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const titleId = `legal-${doc.slug}-title`;

  return (
    // Bottom sheet on phones, centred dialog from sm up
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-[rgba(10,20,36,0.42)] sm:items-center sm:p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-h-[85dvh] flex-col overflow-hidden rounded-t-[30px] bg-surface shadow-ds sm:max-w-2xl sm:max-h-[90vh] sm:rounded-ds-lg"
      >
        {/* Header */}
        <div className="shrink-0 px-[22px] pt-3 sm:pt-5">
          <span aria-hidden className="mx-auto mb-4 block h-[5px] w-11 rounded-[3px] bg-line sm:hidden" />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-ds-lg font-bold leading-tight text-navy">{doc.title}</h2>
              <p className="mt-1 text-ds-xs text-muted">{doc.subtitle}</p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={iconButtonClass}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-[22px] pt-4 pb-4">
          {doc.partyLine && (
            <p className="mb-4 text-ds-2xs font-semibold uppercase tracking-wide text-muted">{doc.partyLine}</p>
          )}
          {doc.intro.length > 0 && (
            <div className="mb-6 space-y-3 border-b border-line pb-5">
              {doc.intro.map((b, i) => <Block key={i} block={b} />)}
            </div>
          )}
          {doc.sections.map(section => (
            <section key={section.id} className="mb-6" aria-labelledby={`${doc.slug}-${section.id}`}>
              <h3 id={`${doc.slug}-${section.id}`} className="mb-2.5 text-ds-control font-bold text-navy">
                {section.title}
              </h3>
              <div className="space-y-3">
                {section.blocks.map((b, i) => <Block key={i} block={b} />)}
              </div>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line px-[22px] pt-3.5 pb-[max(14px,env(safe-area-inset-bottom))]">
          <div className="flex flex-col gap-0.5">
            <span className="text-ds-xs text-muted">{doc.versionLabel}</span>
            <a
              href={legalUrl(doc.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-ds-xs font-bold text-accent hover:underline"
            >
              Open in a new tab <ExternalLink size={11} aria-hidden />
            </a>
          </div>
          <Button onClick={onClose} className="shrink-0">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function Block({ block }: { block: LegalBlock }) {
  const text = "text-ds-sm leading-[1.6] text-ink/80";
  switch (block.kind) {
    case "p":
      return <p className={text}>{block.text}</p>;
    case "clause":
      return (
        <p className={`${text} flex gap-2.5`}>
          <span className="w-8 shrink-0 font-semibold tabular-nums text-muted">{block.num}</span>
          <span className="min-w-0">{block.text}</span>
        </p>
      );
    case "bullets":
      return (
        <ul className={`${text} list-disc space-y-1.5 pl-5 marker:text-line`}>
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-ds-sm border border-line">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-page text-muted">
                {block.headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left align-bottom font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className={`px-3 py-2 align-top ${c === 0 ? "text-ink" : "text-ink/80"}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "callout":
      return (
        <div className="rounded-ds-sm bg-warn-bg px-3.5 py-3 text-ds-xs leading-relaxed text-ink">
          {block.title && <strong className="mb-0.5 block">{block.title}</strong>}
          {block.text}
        </div>
      );
  }
}
