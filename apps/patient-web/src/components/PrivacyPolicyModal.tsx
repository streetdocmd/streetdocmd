"use client";
import { useEffect } from "react";
import { PRIVACY_POLICY_VERSION, PRIVACY_POLICY_LAST_UPDATED } from "@/lib/privacy-policy";

// Matches the approved reference design (navy header, rounded modal,
// five-section scannable content, footer with version + close) rebuilt
// as Tailwind. Purely informational — closing it never itself grants or
// affects consent; callers own the actual consent flow.
export default function PrivacyPolicyModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
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
        aria-labelledby="privacy-modal-title"
        className="flex w-full max-w-lg max-h-[86vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between bg-navy-700 px-6 py-5">
          <div>
            <p className="text-lg font-bold text-white">StreetdocMD</p>
            <p id="privacy-modal-title" className="mt-1 text-sm font-semibold text-white">Privacy Policy</p>
            <p className="mt-0.5 text-xs text-blue-200">How we handle your health information</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pt-5 pb-2">
          <p className="mb-5 border-b border-gray-100 pb-5 text-sm leading-relaxed text-gray-600">
            This is a summary of how StreetdocMD collects, uses, and protects your personal and health information.
            We never sell your data. Read the full policy anytime in Settings.
          </p>

          <Section num={1} title="What we collect">
            <ul className="list-disc space-y-1.5 pl-4 marker:text-gray-300">
              <li>Your name, contact details, address, and date of birth</li>
              <li>Medical history — conditions, medications, allergies, vitals</li>
              <li>Visit records, diagnoses, prescriptions, and lab results</li>
              <li>Your location, only when booking, to send a provider to you</li>
            </ul>
          </Section>

          <Section num={2} title="Why we collect it">
            <p>Solely to connect you with verified doctors, nurses, and physiotherapists, coordinate your care, and process payment for visits.</p>
          </Section>

          <Section num={3} title="Who can see it">
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="px-3 py-2 text-left font-semibold">Who</th>
                    <th className="px-3 py-2 text-left font-semibold">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr><td className="px-3 py-2 align-top text-gray-700">Your care team</td><td className="px-3 py-2 align-top text-gray-600">Only providers actively treating you</td></tr>
                  <tr><td className="px-3 py-2 align-top text-gray-700">Lab / pharmacy / hospital partner</td><td className="px-3 py-2 align-top text-gray-600">Only when your provider refers you to them, and only after you confirm</td></tr>
                  <tr><td className="px-3 py-2 align-top text-gray-700">Paystack</td><td className="px-3 py-2 align-top text-gray-600">To process payment — we never see or store your card details</td></tr>
                  <tr><td className="px-3 py-2 align-top text-gray-700">StreetdocMD team</td><td className="px-3 py-2 align-top text-gray-600">Only for support, safety, and quality review</td></tr>
                </tbody>
              </table>
            </div>
            <div className="mt-2.5 rounded-lg border border-green-200 bg-green-50 px-3.5 py-3 text-xs leading-relaxed text-green-800">
              <strong className="mb-0.5 block">We never sell your information.</strong>
              It is not shared with advertisers or any party outside the list above.
            </div>
          </Section>

          <Section num={4} title="Your choices">
            <ul className="list-disc space-y-1.5 pl-4 marker:text-gray-300">
              <li>Care-team sharing is on by default, so any provider can see your history — you can turn this off anytime in Settings</li>
              <li>Marketing messages are off by default and only sent if you opt in</li>
              <li>You can request a copy of your data or ask us to delete it at any time</li>
            </ul>
            <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-800">
              <strong className="mb-0.5 block">One safety exception</strong>
              If a provider raises a safeguarding concern about your welfare, that note may be reviewed by our team even if care-team sharing is off. This exists only to protect vulnerable patients.
            </div>
          </Section>

          <Section num={5} title="Questions or concerns?">
            <p>Message us on WhatsApp at 07063216791, or contact our support team at contact@streetdocmd.com.</p>
          </Section>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 px-6 py-4">
          <span className="text-xs text-gray-400">
            Policy version {PRIVACY_POLICY_VERSION} · Last updated {PRIVACY_POLICY_LAST_UPDATED}
          </span>
          <button onClick={onClose} className="btn-primary shrink-0 whitespace-nowrap px-5 py-2.5 text-sm">
            Got it, close
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-navy-700">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-light text-[11px] font-semibold text-blue-brand">
          {num}
        </span>
        {title}
      </h3>
      <div className="space-y-1.5 text-[13px] leading-relaxed text-gray-600">
        {children}
      </div>
    </div>
  );
}
