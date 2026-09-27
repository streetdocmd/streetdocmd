"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getPractitionerType,
  PROVIDER_AGREEMENT_ACCEPTANCE_LABEL,
  PROVIDER_AGREEMENT_TITLE,
  PROVIDER_AGREEMENT_VERSION,
} from "@streetdocmd/shared";
import ProviderAgreementModal from "@/components/ProviderAgreementModal";

type DocType = "certificate" | "mdcn_licence" | "nmcn_licence" | "mrtb_licence" | "mlscn_licence";

interface FileSlot {
  type: DocType;
  label: string;
  description: string;
  required: boolean;
  file: File | null;
  uploading: boolean;
  done: boolean;
}

export default function DocumentUploadForm({
  specialty,
}: {
  specialty: string;
}) {
  const router = useRouter();
  const practitionerType = getPractitionerType(specialty);

  const [slots, setSlots] = useState<FileSlot[]>([
    {
      type: "certificate",
      label: "University / Degree Certificate",
      description: "Your medical or health sciences degree certificate (PDF or image)",
      required: true,
      file: null,
      uploading: false,
      done: false,
    },
    ...(practitionerType
      ? [
          {
            type: practitionerType.licenceDocType as DocType,
            label: practitionerType.licenceDocLabel,
            description: `Your current ${practitionerType.licenseBody} practising licence (PDF or image)`,
            required: true,
            file: null,
            uploading: false,
            done: false,
          } as FileSlot,
        ]
      : []),
  ]);

  const [globalError, setGlobalError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Clause 3.2 / 21: must be ticked by the provider — never preselected
  const [agreed, setAgreed] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function setFile(index: number, file: File | null) {
    setSlots(prev => prev.map((s, i) => i === index ? { ...s, file } : s));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError("");

    const required = slots.filter(s => s.required);
    if (required.some(s => !s.file)) {
      setGlobalError("Please select all required documents before uploading.");
      return;
    }
    if (!agreed) {
      setGlobalError(`Please accept the ${PROVIDER_AGREEMENT_TITLE} to continue.`);
      return;
    }

    setSubmitting(true);

    const agreementRes = await fetch("/api/provider-agreement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accepted: true, version: PROVIDER_AGREEMENT_VERSION }),
    });
    if (!agreementRes.ok) {
      const json = await agreementRes.json().catch(() => ({}));
      setGlobalError(json.error ?? "Could not record your acceptance of the agreement. Please try again.");
      setSubmitting(false);
      return;
    }

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot.file) continue;

      setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, uploading: true } : s));

      const body = new FormData();
      body.append("file", slot.file);
      body.append("doc_type", slot.type);

      const res = await fetch("/api/upload-document", { method: "POST", body });
      const json = await res.json();

      if (!res.ok) {
        setGlobalError(`Upload failed for ${slot.label}: ${json.error ?? "Unknown error"}`);
        setSubmitting(false);
        setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, uploading: false } : s));
        return;
      }

      setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, uploading: false, done: true } : s));
    }

    router.push("/onboarding/pending");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {slots.map((slot, i) => (
        <div key={slot.type} className="card p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="font-semibold text-gray-900">
                {slot.label}
                {slot.required && <span className="text-red-500 ml-1">*</span>}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">{slot.description}</p>
            </div>
            {slot.done && (
              <span className="badge bg-green-100 text-green-700 shrink-0">✓ Uploaded</span>
            )}
          </div>

          {!slot.done && (
            <>
              <input
                ref={el => { inputRefs.current[i] = el; }}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={e => setFile(i, e.target.files?.[0] ?? null)}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => inputRefs.current[i]?.click()}
                  className="btn-secondary text-xs px-3 py-2"
                  disabled={slot.uploading}
                >
                  {slot.file ? "Change file" : "Select file"}
                </button>
                {slot.file && (
                  <span className="text-xs text-gray-600 truncate max-w-[200px]">{slot.file.name}</span>
                )}
              </div>
            </>
          )}
        </div>
      ))}

      <div className="rounded-xl border border-blue-mid bg-blue-light p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            disabled={submitting}
            className="mt-0.5 h-4 w-4 shrink-0 accent-blue-brand"
          />
          <span className="text-sm leading-relaxed text-gray-700">{PROVIDER_AGREEMENT_ACCEPTANCE_LABEL}</span>
        </label>
        <div className="mt-2 flex items-center justify-between gap-3 pl-7">
          <button
            type="button"
            onClick={() => setShowAgreement(true)}
            className="text-sm font-semibold text-blue-brand underline-offset-2 hover:underline"
          >
            Read the {PROVIDER_AGREEMENT_TITLE}
          </button>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Required to continue</span>
        </div>
      </div>

      {globalError && (
        <p className="text-red-600 text-sm">{globalError}</p>
      )}

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={submitting || !agreed || slots.filter(s => s.required).some(s => !s.file && !s.done)}
      >
        {submitting ? "Uploading documents…" : "Submit for verification"}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Your documents are reviewed by our team within 24–48 hours.
      </p>

      <ProviderAgreementModal isOpen={showAgreement} onClose={() => setShowAgreement(false)} />
    </form>
  );
}