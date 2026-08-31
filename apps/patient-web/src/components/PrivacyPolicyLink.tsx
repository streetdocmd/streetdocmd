"use client";
import { useState } from "react";
import PrivacyPolicyModal from "./PrivacyPolicyModal";

// Self-contained trigger for opening PrivacyPolicyModal from anywhere that
// isn't already a client component managing its own open/close state (the
// register form manages its own; this is for server-component pages like
// Profile/Settings). Renders as a plain link by default; pass children to
// customize (e.g. a full row for a Settings list).
export default function PrivacyPolicyLink({ children, className }: { children?: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? "text-sm font-medium text-blue-brand hover:underline"}
      >
        {children ?? "Privacy Policy"}
      </button>
      <PrivacyPolicyModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
