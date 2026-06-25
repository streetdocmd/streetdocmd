"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

type DocType = "certificate" | "mdcn_licence" | "nmcn_licence";

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
  const isDoctor = specialty.startsWith("Medical Doctor");
  const isNurse = specialty === "Registered Nurse";

  const licenceType: DocType = isNurse ? "nmcn_licence" : "mdcn_licence";
  const licenceLabel = isNurse ? "NMCN Nursing Licence" : "MDCN Medical Licence";
  const showLicence = isDoctor || isNurse;

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
    ...(showLicence
      ? [
          {
            type: licenceType,
            label: licenceLabel,
            description: `Your current ${isNurse ? "NMCN" : "MDCN"} practising licence (PDF or image)`,
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

    setSubmitting(true);

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

      {globalError && (
        <p className="text-red-600 text-sm">{globalError}</p>
      )}

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={submitting || slots.filter(s => s.required).some(s => !s.file && !s.done)}
      >
        {submitting ? "Uploading documents…" : "Submit for verification"}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Your documents are reviewed by our team within 24–48 hours.
      </p>
    </form>
  );
}