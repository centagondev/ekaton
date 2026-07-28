import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Returns a handler that steps back through history, falling back to a known
 * route when there is nowhere to go.
 *
 * React Router stamps every entry it pushes with an incrementing `idx`. An idx
 * of 0 means this entry is the first one in our own stack — a deep link, a
 * refresh, or a link out of an email — so `navigate(-1)` would either do
 * nothing or drop the user back onto whatever site sent them here.
 *
 * @param fallback Route used when there is no in-app history behind us.
 */
export function useGoBack(fallback: string) {
  const navigate = useNavigate();

  return useCallback(() => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}

interface BackButtonProps {
  /** Where to land when the user arrived here directly. */
  fallback: string;
  /** Describes the destination, e.g. "All events". */
  label: string;
  className?: string;
}

/** Text-style back control for pages inside the app layout. */
export function BackButton({ fallback, label, className }: BackButtonProps) {
  const goBack = useGoBack(fallback);

  return (
    <button
      type="button"
      onClick={goBack}
      className={cn(
        // -mx/-my keeps the 44px tap target from pushing the text off the
        // page's optical left edge.
        "-mx-2 -my-1.5 inline-flex items-center gap-2 px-2 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.2em] text-muted transition-colors hover:text-ink",
        className,
      )}
    >
      <ArrowLeft className="size-4" />
      {label}
    </button>
  );
}
