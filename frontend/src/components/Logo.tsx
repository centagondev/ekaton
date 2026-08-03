import { cn } from "@/lib/utils";

/**
 * Ekaton mark — a stencil "E" cut from a hard-edged yellow tile.
 *
 * Built from four rectangles on a 32-unit grid: no curves, no gradients, no
 * transparency. It stays legible at 16px (favicon) and keeps the same weight
 * as the borders it sits next to.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8 shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      {/* on-accent rather than ink throughout: the mark is a yellow tile in
          both themes, so its frame and glyph have to stay dark in both. */}
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        fill="var(--color-brand-yellow, #FFD600)"
        stroke="var(--color-on-accent, #0A0A0A)"
        strokeWidth="2"
      />
      {/* Spine + three arms — the arms deliberately differ in length so the
          silhouette stays recognisable when the mark is very small. */}
      <g fill="var(--color-on-accent, #0A0A0A)">
        <rect x="9" y="8" width="3.5" height="16" />
        <rect x="9" y="8" width="14" height="3.5" />
        <rect x="9" y="14.25" width="9" height="3.5" />
        <rect x="9" y="20.5" width="14" height="3.5" />
      </g>
    </svg>
  );
}

/**
 * Mark plus wordmark, used in the navigation bars.
 *
 * The mark nudges on hover — enough to feel responsive, small enough that it
 * never competes with the navigation beside it.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("group flex items-center gap-2.5", className)}>
      <LogoMark className="size-7 transition-transform duration-150 group-hover:-translate-y-0.5" />
      <span className="text-[17px] font-black uppercase leading-none tracking-[-0.02em]">
        Ekaton
      </span>
    </span>
  );
}
