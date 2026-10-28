"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, FileText, Upload, RefreshCw, Trash2, CircleAlert, ShieldCheck } from "lucide-react";
import {
  FACILITY_DOC_ACCEPT, FACILITY_DOC_MAX_SIZE, FACILITY_DOC_MIME_TYPES,
  facilityDocSpecs, missingFacilityDocs, type FacilityDocSpec, type FacilityDocument,
} from "@/lib/facility-docs";
import { SUPPORT_EMAIL } from "./config";
import { Spinner, StatusBadge, ui } from "./ui";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function readError(res: Response) {
  const data = await res.json().catch(() => ({}));
  return (data as { error?: string }).error ?? `Something went wrong (${res.status}). Please try again.`;
}

/** Client-side checks, mirrored on the server. */
function validate(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const typeOk = FACILITY_DOC_MIME_TYPES.includes(file.type) || (!file.type && ["pdf", "jpg", "jpeg", "png"].includes(ext));
  if (!typeOk) return "Only PDF, JPG or PNG files can be uploaded.";
  if (file.size === 0) return "This file is empty. Please choose another.";
  if (file.size > FACILITY_DOC_MAX_SIZE) return `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB.`;
  return null;
}

/**
 * Upload section on the pending application page of a partner portal.
 * One file per document type; uploading again replaces it.
 */
export default function FacilityDocumentsUpload({
  facilityType,
  initialDocuments,
  unavailable = false,
}: {
  facilityType: string | null;
  initialDocuments: FacilityDocument[];
  /** facility_documents isn't set up yet (migration not applied). */
  unavailable?: boolean;
}) {
  const router = useRouter();
  const [docs, setDocs] = useState<FacilityDocument[]>(initialDocuments);
  const [busy, setBusy] = useState<string | null>(null); // doc type being uploaded/removed
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  // Pick up server changes after router.refresh()
  useEffect(() => { setDocs(initialDocuments); }, [initialDocuments]);

  const specs = facilityDocSpecs(facilityType);
  const required = specs.filter((s) => s.required);
  const missing = missingFacilityDocs(facilityType, docs.map((d) => d.document_type));
  const done = required.length - missing.length;
  const complete = missing.length === 0;

  function setError(type: string, message: string | null) {
    setErrors((e) => {
      const next = { ...e };
      if (message) next[type] = message; else delete next[type];
      return next;
    });
  }

  async function upload(spec: FacilityDocSpec, file: File) {
    const invalid = validate(file);
    setError(spec.type, invalid);
    if (invalid) return;
    setBusy(spec.type);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("doc_type", spec.type);
      const res = await fetch("/api/facility/documents", { method: "POST", body });
      if (!res.ok) {
        setError(spec.type, await readError(res));
        return;
      }
      const { document } = (await res.json()) as { document: FacilityDocument };
      setDocs((d) => [...d.filter((x) => x.document_type !== spec.type), document]);
      router.refresh();
    } catch {
      setError(spec.type, "Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(spec: FacilityDocSpec, doc: FacilityDocument) {
    setBusy(spec.type);
    setError(spec.type, null);
    try {
      const res = await fetch(`/api/facility/documents?id=${encodeURIComponent(doc.id)}`, { method: "DELETE" });
      if (!res.ok) {
        setError(spec.type, await readError(res));
        return;
      }
      setDocs((d) => d.filter((x) => x.id !== doc.id));
      setConfirmRemove(null);
      router.refresh();
    } catch {
      setError(spec.type, "Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={ui.card}>
      <div className="px-5 sm:px-6 py-5 border-b border-line">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Verification documents</h2>
            <p className="text-xs text-muted mt-0.5">PDF, JPG or PNG, up to 10 MB each. Clear scans or photos of the originals.</p>
          </div>
          {complete
            ? <StatusBadge tone="green" icon={CircleCheck}>Submitted for review</StatusBadge>
            : <StatusBadge tone="amber">{done} of {required.length} required</StatusBadge>}
        </div>
        <div className="mt-4 h-1.5 rounded-full bg-pending-bg overflow-hidden" aria-hidden>
          <div
            className={`h-full rounded-full transition-all ${complete ? "bg-green-600" : "bg-accent"}`}
            style={{ width: `${required.length ? (done / required.length) * 100 : 100}%` }}
          />
        </div>
        {complete ? (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 flex gap-2.5">
            <ShieldCheck size={17} className="shrink-0 mt-0.5" aria-hidden />
            <p>
              <strong>Submitted for review.</strong> We have every required document. Our partnerships team checks them
              manually with the issuing bodies — usually within 48 hours. You can still replace a file until you&apos;re approved.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Still needed: <strong>{missing.map((m) => m.label).join(", ")}</strong>. We start reviewing once all required documents are in.
          </p>
        )}
      </div>

      {unavailable ? (
        <p className="px-6 py-5 text-sm text-amber-800 bg-amber-50">
          Document uploads aren&apos;t available yet. Please check back shortly, or email your documents to {SUPPORT_EMAIL}.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {specs.map((spec) => {
            const doc = docs.find((d) => d.document_type === spec.type);
            const isBusy = busy === spec.type;
            const err = errors[spec.type];
            const inputId = `doc-${spec.type}`;
            return (
              <li key={spec.type} className="px-5 sm:px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${doc ? "bg-green-50 text-green-600" : "bg-pending-bg text-muted"}`}>
                    {doc ? <CircleCheck size={18} aria-hidden /> : <FileText size={18} aria-hidden />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink flex flex-wrap items-center gap-2">
                      {spec.label}
                      {spec.required
                        ? (!doc && <StatusBadge tone="amber">Required</StatusBadge>)
                        : <StatusBadge tone="gray">Optional</StatusBadge>}
                    </p>
                    {doc ? (
                      <p className="text-xs text-muted mt-0.5 truncate">
                        <span className="font-medium text-ink">{doc.file_name ?? "Uploaded file"}</span> · Uploaded {fmtDate(doc.uploaded_at)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted mt-0.5">{spec.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      id={inputId}
                      type="file"
                      accept={FACILITY_DOC_ACCEPT}
                      className="sr-only"
                      disabled={busy !== null}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void upload(spec, f);
                      }}
                    />
                    {confirmRemove === spec.type && doc ? (
                      <>
                        <span className="text-xs text-muted">Remove this file?</span>
                        <button type="button" onClick={() => remove(spec, doc)} disabled={isBusy}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 text-white px-3 py-2 text-xs font-semibold hover:bg-red-700 disabled:opacity-50">
                          {isBusy ? <Spinner className="w-3 h-3" /> : <Trash2 size={13} aria-hidden />} Remove
                        </button>
                        <button type="button" onClick={() => setConfirmRemove(null)} disabled={isBusy} className={`${ui.btnSecondary} px-3 py-2 text-xs`}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <label
                          htmlFor={inputId}
                          aria-disabled={busy !== null}
                          className={`${doc ? ui.btnSecondary : ui.btnPrimary} px-3 py-2 text-xs cursor-pointer ${busy !== null ? "opacity-50 pointer-events-none" : ""}`}
                        >
                          {isBusy
                            ? <><Spinner className="w-3 h-3" /> Uploading…</>
                            : doc
                              ? <><RefreshCw size={13} aria-hidden /> Replace</>
                              : <><Upload size={13} aria-hidden /> Upload</>}
                        </label>
                        {doc && (
                          <button type="button" onClick={() => { setConfirmRemove(spec.type); setError(spec.type, null); }} disabled={busy !== null}
                            className={`${ui.btnSecondary} px-2.5 py-2 text-xs text-red-600`} aria-label={`Remove ${spec.label}`}>
                            <Trash2 size={13} aria-hidden />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {err && (
                  <p role="alert" className="mt-2 sm:ml-12 flex items-start gap-1.5 text-xs text-red-600">
                    <CircleAlert size={13} className="shrink-0 mt-px" aria-hidden /> {err}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
