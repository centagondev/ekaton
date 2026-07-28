import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "lime" | "danger" | "dark";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-yellow text-ink border-ink shadow-brutal",
  secondary: "bg-surface text-ink border-ink shadow-brutal",
  ghost: "bg-transparent text-ink border-transparent shadow-none hover:border-ink",
  lime: "bg-brand-lime text-ink border-ink shadow-brutal",
  danger: "bg-danger text-white border-ink shadow-brutal",
  dark: "bg-ink text-white border-ink shadow-brutal",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-5 py-2.5 text-sm gap-2",
  lg: "px-8 py-3.5 text-base gap-2.5",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: ReactNode;
}

/** The press interaction is the signature of this design system. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center border-2 font-extrabold uppercase tracking-wide",
        "transition-all duration-150 select-none",
        "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-brutal-sm",
        "active:translate-x-[5px] active:translate-y-[5px] active:shadow-none",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
});
