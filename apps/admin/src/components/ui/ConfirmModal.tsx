"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Accessible confirmation dialog. Escape / backdrop click cancel, except
 * while `loading` — so an in-flight action can't be dismissed half-way.
 */
export default function ConfirmModal({
  open,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  loading = false,
  confirmDisabled = false,
  error,
  onConfirm,
  onCancel,
  hideCancel = false,
}: {
  open: boolean;
  title: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger" | "success";
  loading?: boolean;
  confirmDisabled?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  hideCancel?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  const confirmClass =
    tone === "danger" ? "btn-danger" : tone === "success" ? "btn-success" : "btn-primary";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-[1px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        tabIndex={-1}
        className="card w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl outline-none"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <h2 id="confirm-modal-title" className="text-base font-semibold text-gray-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 disabled:opacity-40 -mr-1"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-4 text-sm text-gray-600 space-y-3">{children}</div>
        {error && (
          <div className="mx-6 mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-xl">
          {!hideCancel && (
            <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary">
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
            className={confirmClass}
          >
            {loading && <Spinner />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin ${className}`}
    />
  );
}
