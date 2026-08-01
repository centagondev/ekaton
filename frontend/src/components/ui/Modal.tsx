import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * `brutal` is the app's default chrome — hard ink borders and an offset
 * shadow. `soft` is the Onam campaign's warm surface. Only the skin differs:
 * the focus trap, the Escape handler, the scroll lock and the focus return are
 * one implementation, shared, because those are the parts worth never
 * reimplementing.
 */
type Variant = "brutal" | "soft";

const PANEL: Record<Variant, string> = {
  brutal: "border-2 border-ink bg-surface shadow-brutal-lg",
  soft: "theme-pookalam rounded-t-pk-lg border border-ink-warm/10 bg-cream shadow-lift sm:rounded-pk-lg",
};

const HEADER: Record<Variant, string> = {
  brutal: "border-b-2 border-ink px-5 py-4",
  soft: "border-b border-ink-warm/[0.08] px-5 py-4",
};

const TITLE: Record<Variant, string> = {
  brutal: "text-lg font-black uppercase tracking-wide",
  soft: "font-display text-[22px] font-extrabold tracking-[-0.02em] text-ink-warm",
};

const CLOSE: Record<Variant, string> = {
  brutal: "border-2 border-transparent p-1 text-muted transition-colors hover:border-ink hover:text-ink",
  soft: "rounded-full border border-transparent p-1.5 text-ink-soft transition-colors hover:border-ink-warm/15 hover:bg-kasavu hover:text-ink-warm",
};

const BACKDROP: Record<Variant, string> = {
  brutal: "bg-ink/60",
  soft: "bg-ink-warm/45 backdrop-blur-[8px]",
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  /** Hide the close affordance for flows that must be completed. */
  dismissible?: boolean;
  variant?: Variant;
  /**
   * Render the header bar. Turn it off for panels that present their own
   * heading — the dialog keeps its accessible name either way, because that
   * comes from `aria-label={title}` on the panel rather than from the bar.
   */
  chrome?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  dismissible = true,
  variant = "brutal",
  chrome = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog for screen readers and keyboard users.
    const timer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])',
      );
      (focusable ?? panelRef.current)?.focus();
    }, 40);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      // Trap focus inside the dialog.
      const nodes = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose, dismissible]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn("absolute inset-0", BACKDROP[variant])}
            onClick={dismissible ? onClose : undefined}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className={cn(
              "relative w-full max-w-lg",
              PANEL[variant],
              "max-h-[92dvh] overflow-y-auto scroll-thin",
              className,
            )}
          >
            {chrome && (
              <div className={cn("flex items-center justify-between", HEADER[variant])}>
                <h2 className={TITLE[variant]}>{title}</h2>
                {dismissible && (
                  <button onClick={onClose} aria-label="Close dialog" className={CLOSE[variant]}>
                    <X className="size-5" />
                  </button>
                )}
              </div>
            )}
            {chrome ? <div className="p-5">{children}</div> : children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
