import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "yellow" | "lime" | "lavender" | "danger" | "neutral" | "dark";

const TONES: Record<BadgeTone, string> = {
  yellow: "bg-brand-yellow text-ink border-ink",
  lime: "bg-brand-lime text-ink border-ink",
  lavender: "bg-brand-lavender text-ink border-ink",
  danger: "bg-danger text-white border-ink",
  neutral: "bg-surface text-ink border-ink",
  // See Button: bg-ink inverts with the theme, and `on-ink` is white in light.
  dark: "bg-ink text-on-ink border-ink",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em]",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
