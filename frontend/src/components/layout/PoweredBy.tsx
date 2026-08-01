import { cn } from "@/lib/utils";

/**
 * "Powered by Centagon" credit line.
 *
 * Rendered as the last line of the home hero rather than pinned to the
 * viewport edge: on a centred single-screen page a pinned footer floated in
 * its own band of empty space, far below the content it belongs to. Sitting
 * in the hero flow keeps it aligned with the text above it at every screen
 * size — and scopes it to the hero alone, so the searching state stays clean.
 * Styled in the existing mono-caption voice so it reads as a colophon.
 */
export function PoweredBy({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "shrink-0 select-none text-center font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-muted sm:text-xs",
        className,
      )}
    >
      Powered by <span className="text-ink">Centagon</span>
    </footer>
  );
}
