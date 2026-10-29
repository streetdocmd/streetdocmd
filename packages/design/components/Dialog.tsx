"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, buttonClass } from "./Button";
import { inputClass, fieldLabelClass } from "./Input";
import { cx } from "./cx";

// In-app dialogs in place of the browser's alert, confirm and prompt.
// Wrap the app in <DialogProvider>, then:
//   const dialog = useDialog();
//   if (!(await dialog.confirm({ title: "Cancel this visit?" }))) return;
//   const reason = await dialog.prompt({ title: "Why?", required: true }); // null when cancelled

interface BaseOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
}
export interface ConfirmOptions extends BaseOptions {
  /** Red confirm button for destructive actions */
  tone?: "default" | "danger";
}
export interface PromptOptions extends BaseOptions {
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  /** The confirm button stays off until something is typed */
  required?: boolean;
  multiline?: boolean;
  inputType?: "text" | "datetime-local" | "date";
  maxLength?: number;
  tone?: "default" | "danger";
}

type Request =
  | { kind: "confirm"; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "prompt"; options: PromptOptions; resolve: (v: string | null) => void }
  | { kind: "alert"; options: BaseOptions; resolve: () => void };

interface DialogApi {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  prompt: (o: PromptOptions) => Promise<string | null>;
  alert: (o: BaseOptions) => Promise<void>;
}

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const api = useContext(DialogContext);
  if (!api) throw new Error("useDialog needs <DialogProvider> around the app");
  return api;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);

  const api: DialogApi = {
    confirm: useCallback(options => new Promise<boolean>(resolve => setRequest({ kind: "confirm", options, resolve })), []),
    prompt: useCallback(options => new Promise<string | null>(resolve => setRequest({ kind: "prompt", options, resolve })), []),
    alert: useCallback(options => new Promise<void>(resolve => setRequest({ kind: "alert", options, resolve })), []),
  };

  return (
    <DialogContext.Provider value={api}>
      {children}
      {request && <DialogView request={request} onDone={() => setRequest(null)} />}
    </DialogContext.Provider>
  );
}

function DialogView({ request, onDone }: { request: Request; onDone: () => void }) {
  const o = request.options as PromptOptions & ConfirmOptions;
  const [value, setValue] = useState(request.kind === "prompt" ? o.defaultValue ?? "" : "");
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<Element | null>(null);

  function finish(ok: boolean) {
    if (request.kind === "confirm") request.resolve(ok);
    else if (request.kind === "prompt") request.resolve(ok ? value.trim() : null);
    else request.resolve();
    onDone();
  }

  useEffect(() => {
    returnFocus.current = document.activeElement;
    (request.kind === "prompt" ? inputRef.current : confirmRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(false); };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      (returnFocus.current as HTMLElement | null)?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blocked = request.kind === "prompt" && o.required && !value.trim();
  const danger = o.tone === "danger";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/50 p-4 backdrop-blur-[1px] sm:items-center"
      onMouseDown={e => { if (e.target === e.currentTarget) finish(false); }}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="sdmd-dialog-title"
        onSubmit={e => { e.preventDefault(); if (!blocked) finish(true); }}
        className="w-full max-w-md rounded-ds-lg border border-line bg-surface p-5 text-ink shadow-ds"
      >
        <h2 id="sdmd-dialog-title" className="text-ds-lg font-extrabold leading-tight text-navy">{o.title}</h2>
        {o.message && <div className="mt-2 text-ds-sm leading-relaxed text-muted">{o.message}</div>}

        {request.kind === "prompt" && (
          <div className="mt-4">
            {o.label && <label htmlFor="sdmd-dialog-input" className={fieldLabelClass}>{o.label}</label>}
            {o.multiline ? (
              <textarea id="sdmd-dialog-input" ref={inputRef} rows={3} maxLength={o.maxLength ?? 1000}
                value={value} onChange={e => setValue(e.target.value)} placeholder={o.placeholder}
                className={inputClass(false, "min-h-24 resize-none py-3 leading-normal")} />
            ) : (
              <input id="sdmd-dialog-input" ref={inputRef} type={o.inputType ?? "text"} maxLength={o.maxLength ?? 300}
                value={value} onChange={e => setValue(e.target.value)} placeholder={o.placeholder} className={inputClass()} />
            )}
            {!o.required && <p className="mt-1.5 text-ds-xs text-muted">Optional</p>}
          </div>
        )}

        <div className={cx("mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end")}>
          {request.kind !== "alert" && (
            <Button type="button" variant="secondary" onClick={() => finish(false)}>{o.cancelLabel ?? "Cancel"}</Button>
          )}
          <button ref={confirmRef} type="submit" disabled={blocked} className={buttonClass(danger ? "danger" : "primary")}>
            {o.confirmLabel ?? (request.kind === "alert" ? "OK" : request.kind === "prompt" ? "Send" : "Confirm")}
          </button>
        </div>
      </form>
    </div>
  );
}
