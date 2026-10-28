"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import {
  getPractitionerType,
  PROVIDER_AGREEMENT_ACCEPTANCE_LABEL,
  PROVIDER_AGREEMENT_TITLE,
  PROVIDER_AGREEMENT_VERSION,
} from "@streetdocmd/shared";
import ProviderAgreementModal from "@/components/ProviderAgreementModal";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

interface FileSlot {
  type: string;
  label: string;
  description: string;
  /** a document of this type is already on file from an earlier attempt */
  onFile: boolean;
  file: File | null;
  uploading: boolean;
  done: boolean;
  error: string;
}

export default function DocumentUploadForm({
  specialty,
  uploadedTypes,
  isReapplying,
  agreementAccepted,
}: {
  specialty: string;
  uploadedTypes: string[];
  isReapplying: boolean;
  agreementAccepted: boolean;
}) {
  const router = useRouter();
  const practitionerType = getPractitionerType(specialty);

  const [slots, setSlots] = useState<FileSlot[]>(() => {
    const base = [
      {
        type: "certificate",
        label: "University / Degree Certificate",
        description: "Your medical or health sciences degree certificate",
      },
      ...(practitionerType
        ? [{
            type: practitionerType.licenceDocType,
            label: practitionerType.licenceDocLabel,
            description: `Your current ${practitionerType.licenseBody} practising licence`,
          }]
        : []),
    ];
    return base.map(s => ({
      ...s,
      onFile: uploadedTypes.includes(s.type),
      file: null,
      uploading: false,
      done: false,
      error: "",
    }));
  });

  const [globalError, setGlobalError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Clause 3.2 / 21: must be ticked by the provider — never preselected
  const [agreed, setAgreed] = useState(false);
  const [agreementSaved, setAgreementSaved] = useState(agreementAccepted);
  const [showAgreement, setShowAgreement] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function patchSlot(index: number, patch: Partial<FileSlot>) {
    setSlots(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function pickFile(index: number, file: File | null) {
    setGlobalError("");
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      patchSlot(index, { file: null, error: "Please choose a PDF, JPG or PNG file." });
      return;
    }
    if (file.size > MAX_SIZE) {
      patchSlot(index, { file: null, error: "This file is larger than 10 MB. Please choose a smaller file or scan." });
      return;
    }
    patchSlot(index, { file, error: "", done: false });
  }

  // Each slot is satisfied by a fresh file or one already on file (from an
  // earlier attempt that stopped half-way). A re-application must include at
  // least one new document.
  const allCovered = slots.every(s => s.file || s.onFile || s.done);
  const hasNewFile = slots.some(s => s.file || s.done);
  const needsAgreement = !agreementSaved;
  const canSubmit = allCovered && (!isReapplying || hasNewFile) && (!needsAgreement || agreed) && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setGlobalError("");

    if (!allCovered) {
      setGlobalError("Please select every required document before submitting.");
      return;
    }
    if (isReapplying && !hasNewFile) {
      setGlobalError("Please choose at least one corrected document to upload.");
      return;
    }
    if (needsAgreement && !agreed) {
      setGlobalError(`Please accept the ${PROVIDER_AGREEMENT_TITLE} to continue.`);
      return;
    }

    setSubmitting(true);
    try {
      if (needsAgreement) {
        const agreementRes = await fetch("/api/provider-agreement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accepted: true, version: PROVIDER_AGREEMENT_VERSION }),
        });
        if (!agreementRes.ok) {
          const json = await agreementRes.json().catch(() => ({}));
          setGlobalError(json.error ?? "Could not record your acceptance of the agreement. Please try again.");
          return;
        }
        setAgreementSaved(true);
      }

      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (!slot.file) continue;

        patchSlot(i, { uploading: true, error: "" });
        const body = new FormData();
        body.append("file", slot.file);
        body.append("doc_type", slot.type);

        const res = await fetch("/api/upload-document", { method: "POST", body });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          patchSlot(i, { uploading: false, error: json.error ?? "Upload failed. Please try again." });
          setGlobalError(`We couldn't upload your ${slot.label}. Fix the issue above and submit again — anything already uploaded is saved.`);
          return;
        }
        // Uploaded: the slot now counts as on file, so a retry won't resend it.
        patchSlot(i, { uploading: false, done: true, onFile: true, file: null });
      }

      const submitRes = await fetch("/api/onboarding/submit", { method: "POST" });
      if (!submitRes.ok) {
        const json = await submitRes.json().catch(() => ({}));
        setGlobalError(json.error ?? "Could not submit your application. Please try again.");
        return;
      }

      router.push("/onboarding/pending");
      router.refresh();
    } catch {
      setGlobalError("Network problem — please check your connection and try again. Anything already uploaded is saved.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {slots.map((slot, i) => (
        <div key={slot.type} className={`card p-5 ${slot.error ? "border-red-200" : ""}`}>
          <div className="flex items-start gap-3.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${slot.done ? "bg-green-50" : "bg-accent-soft"}`}>
              {slot.done
                ? <CheckCircle2 size={20} className="text-green-600" />
                : <FileText size={20} className="text-accent" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-ink">
                  {slot.label}
                  {!slot.onFile && <span className="text-red-500 ml-1" aria-hidden>*</span>}
                </h3>
                {slot.done ? (
                  <span className="badge bg-green-100 text-green-700">Uploaded</span>
                ) : slot.onFile ? (
                  <span className="badge bg-pending-bg text-muted">On file</span>
                ) : null}
              </div>
              <p className="text-xs text-muted mt-0.5">
                {slot.description} · PDF, JPG or PNG, up to 10 MB
                {slot.onFile && !slot.done && (isReapplying ? " · upload a new copy if this one was flagged" : " · you can replace it")}
              </p>

              {!slot.done && (
                <>
                  <input
                    ref={el => { inputRefs.current[i] = el; }}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    className="hidden"
                    onChange={e => { pickFile(i, e.target.files?.[0] ?? null); e.target.value = ""; }}
                  />
                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <button
                      type="button"
                      onClick={() => inputRefs.current[i]?.click()}
                      className="btn-secondary inline-flex items-center gap-1.5 text-xs px-3 py-2"
                      disabled={submitting}
                    >
                      {slot.uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {slot.uploading ? "Uploading…" : slot.file ? "Change file" : slot.onFile ? "Replace file" : "Select file"}
                    </button>
                    {slot.file && (
                      <span className="text-xs text-muted truncate max-w-[220px]" title={slot.file.name}>{slot.file.name}</span>
                    )}
                  </div>
                </>
              )}
              {slot.error && <p className="text-xs text-red-600 mt-2">{slot.error}</p>}
            </div>
          </div>
        </div>
      ))}

      {needsAgreement ? (
        <div className="rounded-xl border border-accent/40 bg-accent-soft p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => { setAgreed(e.target.checked); setGlobalError(""); }}
              disabled={submitting}
              className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
            />
            <span className="text-sm leading-relaxed text-ink">{PROVIDER_AGREEMENT_ACCEPTANCE_LABEL}</span>
          </label>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 pl-7">
            <button
              type="button"
              onClick={() => setShowAgreement(true)}
              className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
            >
              Read the {PROVIDER_AGREEMENT_TITLE}
            </button>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Required to continue</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          <span>
            You&apos;ve accepted the {PROVIDER_AGREEMENT_TITLE} (v{PROVIDER_AGREEMENT_VERSION}).{" "}
            <button type="button" onClick={() => setShowAgreement(true)} className="font-medium text-accent hover:underline">
              Read it again
            </button>
          </span>
        </div>
      )}

      {globalError && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {globalError}
        </div>
      )}

      <button type="submit" className="btn-primary w-full inline-flex items-center justify-center gap-2" disabled={!canSubmit}>
        {submitting && <Loader2 size={16} className="animate-spin" />}
        {submitting ? "Submitting…" : isReapplying ? "Re-submit for verification" : "Submit for verification"}
      </button>

      <p className="text-xs text-muted text-center">
        Your documents are stored privately and only seen by the StreetdocMD verification team.
      </p>

      <ProviderAgreementModal isOpen={showAgreement} onClose={() => setShowAgreement(false)} />
    </form>
  );
}
