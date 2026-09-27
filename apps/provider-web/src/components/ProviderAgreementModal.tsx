"use client";
import { useEffect } from "react";
import {
  PROVIDER_AGREEMENT_INTRO,
  PROVIDER_AGREEMENT_PARTY_LINE,
  PROVIDER_AGREEMENT_SCHEDULE_1,
  PROVIDER_AGREEMENT_SCHEDULE_2,
  PROVIDER_AGREEMENT_SECTIONS,
  PROVIDER_AGREEMENT_SUBTITLE,
  PROVIDER_AGREEMENT_TITLE,
  PROVIDER_AGREEMENT_VERSION,
  PROVIDER_AGREEMENT_YEAR,
} from "@streetdocmd/shared";

// Full text of the Provider Service Agreement, laid out like patient-web's PrivacyPolicyModal.
// Purely for reading: closing it never grants acceptance — the unchecked checkbox on the form does.
export default function ProviderAgreementModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/60 backdrop-blur-[2px] p-4 sm:p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agreement-modal-title"
        className="flex w-full max-w-2xl max-h-[88vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between bg-navy-700 px-6 py-5">
          <div>
            <p className="text-lg font-bold text-white">StreetdocMD</p>
            <p id="agreement-modal-title" className="mt-1 text-sm font-semibold text-white">{PROVIDER_AGREEMENT_TITLE}</p>
            <p className="mt-0.5 text-xs text-blue-200">{PROVIDER_AGREEMENT_SUBTITLE}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pt-5 pb-2 text-[13px] leading-relaxed text-gray-600">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{PROVIDER_AGREEMENT_PARTY_LINE}</p>
          <p className="mb-5 rounded-lg bg-gray-50 px-4 py-3">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Online agreement</span>
            {PROVIDER_AGREEMENT_INTRO}
          </p>

          {PROVIDER_AGREEMENT_SECTIONS.map(section => (
            <section key={section.num} className="mb-5">
              <h3 className="mb-2 text-sm font-bold text-navy-700">
                {section.num}. {section.title}
              </h3>
              <div className="space-y-1.5">
                {section.clauses.map(([n, text]) => <Clause key={n} n={n} text={text} />)}
                {section.bullets && (
                  <ul className="list-disc space-y-1 pl-5 marker:text-gray-300">
                    {section.bullets.map(b => <li key={b}>{b}</li>)}
                  </ul>
                )}
                {section.after?.map(([n, text]) => <Clause key={n} n={n} text={text} />)}
              </div>
            </section>
          ))}

          <section className="mb-5">
            <h3 className="mb-2 text-sm font-bold text-navy-700">Schedule 1. Provider Commercial Framework</h3>
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="px-3 py-2 text-left font-semibold">Commercial item</th>
                    <th className="px-3 py-2 text-left font-semibold">Framework</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {PROVIDER_AGREEMENT_SCHEDULE_1.map(([item, framework]) => (
                    <tr key={item}>
                      <td className="px-3 py-2 align-top font-medium text-gray-700">{item}</td>
                      <td className="px-3 py-2 align-top text-gray-600">{framework}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-5">
            <h3 className="mb-2 text-sm font-bold text-navy-700">Schedule 2. Professional and Operational Particulars</h3>
            <p>{PROVIDER_AGREEMENT_SCHEDULE_2}</p>
          </section>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 px-6 py-4">
          <span className="text-xs text-gray-400">
            Version {PROVIDER_AGREEMENT_VERSION} · {PROVIDER_AGREEMENT_YEAR}
          </span>
          <button type="button" onClick={onClose} className="btn-primary shrink-0 whitespace-nowrap px-5 py-2.5 text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Clause({ n, text }: { n: string; text: string }) {
  return (
    <p>
      <span className="font-semibold text-gray-700">{n}</span> {text}
    </p>
  );
}
