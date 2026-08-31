"use client";
import { useState } from "react";
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
    <div className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-amber-800">
        Our Privacy Policy has been updated. Please take a moment to review the changes.
      </p>
      <div className="flex shrink-0 gap-3">
        <button
          onClick={() => setOpen(true)}
          className="text-sm font-semibold text-amber-800 hover:underline"
        >
          Review Policy
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-sm text-amber-600 hover:text-amber-800"
        >
          Dismiss
        </button>
      </div>
      <PrivacyPolicyModal isOpen={open} onClose={() => setOpen(false)} />
    </div>
  );
}
