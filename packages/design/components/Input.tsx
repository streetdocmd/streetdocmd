import { CircleAlert } from "lucide-react";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "./cx";

/** Field styles, for inputs that need their own wrapper (e.g. a password field with a show toggle). */
export function inputClass(invalid = false, className?: string): string {
  return cx(
    "w-full min-h-[52px] px-4 rounded-ds border-[1.5px] bg-surface text-ds-control text-ink placeholder:text-muted",
    "focus:outline-none focus:ring-4",
    invalid ? "border-danger focus:ring-danger-bg" : "border-line focus:border-accent focus:ring-accent-soft",
    "disabled:bg-page disabled:text-muted disabled:cursor-not-allowed",
    className,
  );
}

/** Label styles matching Input's own label. */
export const fieldLabelClass = "block mb-1.5 text-ds-sm font-semibold text-ink";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Classes for the wrapper around label, input and messages. */
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, className, wrapperClassName, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={wrapperClassName}>
      {label && (
        <label htmlFor={inputId} className={fieldLabelClass}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={cx(hintId, errorId) || undefined}
        {...rest}
        className={inputClass(!!error, className)}
      />
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-ds-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 flex items-center gap-1.5 text-ds-xs font-semibold text-danger">
          <CircleAlert size={14} aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
});
