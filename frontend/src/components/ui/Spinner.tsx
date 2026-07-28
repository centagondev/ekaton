import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/Logo";

/** Square rotating frame — no circles anywhere in this system. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block size-5 animate-spin border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

/** Branded full-screen loader — the mark carries the wait, not a bare spinner. */
export function FullPageLoader() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-canvas"
      role="status"
      aria-label="Loading"
    >
      <div className="flex flex-col items-center gap-5">
        <LogoMark className="size-12 animate-pulse" />
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-muted">
          Ekaton
        </p>
      </div>
    </div>
  );
}
