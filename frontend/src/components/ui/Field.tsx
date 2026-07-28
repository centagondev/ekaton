import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

const controlClasses =
  "w-full border-2 border-ink bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-muted/60 " +
  "transition-all focus:shadow-brutal-sm focus:outline-none disabled:bg-raised disabled:opacity-100 disabled:text-muted";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controlClasses, className)} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea ref={ref} className={cn(controlClasses, "min-h-28 resize-y", className)} {...props} />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(controlClasses, "appearance-none", className)} {...props}>
      {children}
    </select>
  );
});

interface FieldProps {
  label?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  children: ReactNode | ((id: string) => ReactNode);
}

export function Field({ label, error, hint, required, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={id}
          className="block font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-muted"
        >
          {label}
          {required && (
            <span className="text-danger" aria-hidden="true">
              {" "}
              *
            </span>
          )}
        </label>
      )}
      {typeof children === "function" ? children(id) : children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-bold text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {/* aria wiring for consumers that spread props themselves */}
      <span hidden aria-hidden="true" data-described-by={describedBy} />
    </div>
  );
}
