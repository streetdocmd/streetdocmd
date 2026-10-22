"use client";
import { useEffect, useRef } from "react";
import { ExternalLink, X } from "lucide-react";
import { legalUrl, type LegalBlock, type LegalDocument } from "@/lib/legal";

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
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-navy-900/60 backdrop-blur-[2px] p-3 sm:p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 bg-navy-700 px-5 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">StreetdocMD</p>
            <h2 id={titleId} className="mt-1 text-lg font-bold text-white">{doc.title}</h2>
            <p className="mt-0.5 text-xs text-blue-200">{doc.subtitle}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4 sm:px-6">
          {doc.partyLine && (
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{doc.partyLine}</p>
          )}
          {doc.intro.length > 0 && (
            <div className="mb-6 space-y-3 border-b border-gray-100 pb-5">
              {doc.intro.map((b, i) => <Block key={i} block={b} />)}
            </div>
          )}
          {doc.sections.map(section => (
            <section key={section.id} className="mb-6" aria-labelledby={`${doc.slug}-${section.id}`}>
              <h3 id={`${doc.slug}-${section.id}`} className="mb-2.5 text-sm font-bold text-navy-700">
                {section.title}
              </h3>
              <div className="space-y-2.5">
                {section.blocks.map((b, i) => <Block key={i} block={b} />)}
              </div>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3.5 sm:px-6">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-400">{doc.versionLabel}</span>
            <a
              href={legalUrl(doc.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-brand hover:underline"
            >
              Open in a new tab <ExternalLink size={11} />
            </a>
          </div>
          <button type="button" onClick={onClose} className="btn-primary shrink-0 whitespace-nowrap px-5 py-2.5 text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Block({ block }: { block: LegalBlock }) {
  const text = "text-[13px] leading-relaxed text-gray-600";
  switch (block.kind) {
    case "p":
      return <p className={text}>{block.text}</p>;
    case "clause":
      return (
        <p className={`${text} flex gap-2.5`}>
          <span className="w-8 shrink-0 font-semibold tabular-nums text-gray-400">{block.num}</span>
          <span className="min-w-0">{block.text}</span>
        </p>
      );
    case "bullets":
      return (
        <ul className={`${text} list-disc space-y-1.5 pl-5 marker:text-gray-300`}>
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                {block.headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left align-bottom font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className={`px-3 py-2 align-top ${c === 0 ? "text-gray-700" : "text-gray-600"}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "callout":
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-800">
          {block.title && <strong className="mb-0.5 block">{block.title}</strong>}
          {block.text}
        </div>
      );
  }
}
