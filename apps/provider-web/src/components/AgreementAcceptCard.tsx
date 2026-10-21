"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileSignature } from "lucide-react";
import {
  PROVIDER_AGREEMENT_ACCEPTANCE_LABEL,
  PROVIDER_AGREEMENT_TITLE,
  PROVIDER_AGREEMENT_VERSION,
} from "@streetdocmd/shared";
import ProviderAgreementModal from "./ProviderAgreementModal";

/**
 * For providers whose account predates the current agreement version
 * (clause 17.2: a material change needs fresh acceptance). Same unchecked
 * checkbox + server-recorded timestamp as the registration step.
 */
export default function AgreementAcceptCard({ updated = false }: { updated?: boolean }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function accept() {
    if (!agreed || saving) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/provider-agreement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accepted: true, version: PROVIDER_AGREEMENT_VERSION }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Could not record your acceptance. Please try again.");
      setSaving(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="card p-5 border-blue-mid">
      <div className="flex items-start gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-blue-light flex items-center justify-center shrink-0">
          <FileSignature size={20} className="text-blue-brand" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">
            {updated ? `Review the updated ${PROVIDER_AGREEMENT_TITLE}` : `Accept the ${PROVIDER_AGREEMENT_TITLE}`}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            Version {PROVIDER_AGREEMENT_VERSION} sets out commission, payouts, insurance and conduct terms for
            providers on StreetdocMD. Please read and accept it to keep receiving bookings.
          </p>

          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              disabled={saving}
              className="mt-0.5 h-4 w-4 shrink-0 accent-blue-brand"
            />
            <span className="text-sm leading-relaxed text-gray-700">{PROVIDER_AGREEMENT_ACCEPTANCE_LABEL}</span>
          </label>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={accept} disabled={!agreed || saving} className="btn-primary">
              {saving ? "Saving…" : "Accept agreement"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-sm font-semibold text-blue-brand underline-offset-2 hover:underline"
            >
              Read the agreement
            </button>
          </div>
        </div>
      </div>
      <ProviderAgreementModal isOpen={open} onClose={() => setOpen(false)} />
    </div>
  );
}
