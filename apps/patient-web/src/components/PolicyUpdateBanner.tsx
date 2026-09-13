"use client";
import { useState } from "react";
import { Info, X } from "lucide-react";
import PrivacyPolicyModal from "./PrivacyPolicyModal";

// Shown on login when users.core_consent_policy_version doesn't match the
// current PRIVACY_POLICY_VERSION (see dashboard/layout.tsx). Deliberately
// not a hard re-consent gate for this pass — just a visible, dismissible
// prompt to review the updated policy.
export default function PolicyUpdateBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);

  if (dismissed) return null;

  return (
    <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-amber-200/70 bg-amber-50 pl-3 pr-2 py-2">
      <Info size={15} className="text-amber-600 shrink-0" />
      <p className="text-xs text-amber-800 flex-1 min-w-0">
        Our Privacy Policy has been updated.{" "}
        <button onClick={() => setOpen(true)} className="font-semibold hover:underline">
          Review changes
        </button>
      </p>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 text-amber-500 hover:text-amber-700 hover:bg-amber-100 rounded-md p-1 transition-colors"
      >
        <X size={14} />
      </button>
      <PrivacyPolicyModal isOpen={open} onClose={() => setOpen(false)} />
    </div>
  );
}
