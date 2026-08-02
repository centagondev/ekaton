import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { COARSE_POINTER } from "@/lib/useChatViewport";
import { lockBodyScroll } from "@/lib/scrollLock";
import { cn } from "@/lib/utils";

/**
 * `brutal` is the app's default chrome — hard ink borders and an offset
 * shadow. `soft` is the Onam campaign's warm surface. Only the skin differs:
 * the focus trap, the Escape handler, the scroll lock and the focus return are
 * one implementation, shared, because those are the parts worth never
 * reimplementing.
 */
type Variant = "brutal" | "soft";

/**
 * Width, chosen by name rather than by a `max-w-*` in `className`.
 *
 * Below `sm` the panel is a bottom sheet and must run edge to edge — a capped
 * width there leaves the scrim showing down both sides of the sheet, which is
 * what the logout dialog looked like when it passed `max-w-sm` straight
 * through. Because `cn` is a plain join and not tailwind-merge, a width in
 * `className` could not be overridden here by breakpoint; naming the size
 * instead keeps that decision in one place, and every size is `sm:`-scoped so
 * the phone sheet is always full-bleed.
 */
type Size = "sm" | "md" | "lg";

const SIZE: Record<Size, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
};

/* ------------------------------- performance ------------------------------ */

/**
 * Why this sheet is cheap, and what will make it expensive again.
 *
 * Below `sm` this is a bottom sheet, which on a phone means a surface the
 * width of the viewport moving over the whole page. Three things used to make
 * that stutter on mid- and low-end devices, and all three are decided here
 * rather than at the call sites:
 *
 *   1. `backdrop-filter` on the scrim. Blurring a full-screen layer makes the
 *      browser re-composite everything behind it on every frame the scrim's
 *      opacity changes — i.e. the entire opening and closing animation. The
 *      admin sheet dropped it for exactly this reason; a flat scrim reads the
 *      same and costs nothing.
 *   2. `scale` on the panel. Text inside a scaled layer is re-rasterised at
 *      every intermediate scale. Translation alone runs on the compositor with
 *      no repaint at all, so the phone sheet moves and the desktop dialog —
 *      small, centred, and not covering a page of text — keeps its scale.
 *   3. Autofocusing an input. On touch that opens the keyboard *during* the
 *      slide, and the viewport resize that follows re-lays-out the sheet every
 *      frame. Focus now waits for the animation and lands on the panel on
 *      coarse pointers.
 *
 * The springs are gone too: a spring settles on a threshold, so its tail is
 * both invisible and unbounded. A 220ms tween with a sheet curve arrives when
 * it says it will, which is what "opens instantly" actually means.
 */

/** The canonical sheet curve — fast off the mark, long glide into rest. */
const SHEET_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

const SHEET_IN = { type: "tween", duration: 0.22, ease: SHEET_EASE } as const;
/**
 * Dismissal is quicker than arrival; a slow exit is what reads as "delayed".
 * It keeps the sheet curve rather than easing *in*: an ease-in exit holds the
 * panel still for its first frames, and that pause is exactly the lag the
 * dismissal is trying not to have.
 */
const SHEET_OUT = { type: "tween", duration: 0.16, ease: SHEET_EASE } as const;
/** The scrim only ever crossfades, and never slower than the panel moves. */
const SCRIM = { duration: 0.16, ease: "linear" } as const;

/**
 * Phone-sheet geometry, matching the `sm:` breakpoint the layout below uses.
 *
 * One module-level query shared by every Modal in the app, rather than one per
 * instance: a page with four dialogs mounted was previously four listeners for
 * one fact. Read through `useSyncExternalStore` so the first render already
 * knows the answer — deciding it in an effect would render the desktop
 * animation for a frame and then swap targets underneath a running slide.
 */
/* 639.98px, not 639px: Tailwind's `sm:` starts at min-width 640px, and a
   fractional viewport between the two would otherwise pick the dialog
   animation for a panel the layout is still rendering as a sheet. */
const SHEET_QUERY =
  typeof window === "undefined" ? null : window.matchMedia("(max-width: 639.98px)");

function useIsSheet(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      SHEET_QUERY?.addEventListener("change", onChange);
      return () => SHEET_QUERY?.removeEventListener("change", onChange);
    },
    () => SHEET_QUERY?.matches ?? false,
    () => false,
  );
}

const PANEL: Record<Variant, string> = {
  brutal: "border-2 border-ink bg-surface shadow-brutal-lg",
  soft: "theme-pookalam rounded-t-pk-lg border border-ink-warm/10 bg-cream shadow-lift sm:rounded-pk-lg",
};

/**
 * The header is sticky so a long sheet — the password form with its live
 * checklist is the tall one — keeps its title and its ✕ reachable while the
 * body scrolls under it. It carries the panel's own background for that:
 * a transparent sticky bar would let the content pass through it.
 */
const HEADER: Record<Variant, string> = {
  brutal: "sticky top-0 z-10 border-b-2 border-ink bg-surface px-5 py-4",
  soft: "sticky top-0 z-10 border-b border-ink-warm/[0.08] bg-cream px-5 py-4",
};

const TITLE: Record<Variant, string> = {
  brutal: "text-lg font-black uppercase tracking-wide",
  soft: "font-display text-[22px] font-extrabold tracking-[-0.02em] text-ink-warm",
};

const CLOSE: Record<Variant, string> = {
  brutal: "border-2 border-transparent p-1 text-muted transition-colors hover:border-ink hover:text-ink",
  soft: "rounded-full border border-transparent p-1.5 text-ink-soft transition-colors hover:border-ink-warm/15 hover:bg-kasavu hover:text-ink-warm",
};

/**
 * Flat scrims, deliberately. The `soft` one is carried a little deeper than
 * the /45 it replaced, because it no longer has a blur helping it separate the
 * sheet from the page behind it — see the performance note above.
 */
const BACKDROP: Record<Variant, string> = {
  brutal: "bg-ink/60",
  soft: "bg-ink-warm/60",
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
  /** Panel width from `sm:` up; the phone sheet is always full-bleed. */
  size?: Size;
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
  size = "lg",
  chrome = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const sheet = useIsSheet();

  /**
   * The callbacks, read through refs so the effect below depends on `open`
   * alone.
   *
   * Call sites pass `onClose={() => setOpen(false)}` — a new function on every
   * render of the page holding the dialog. With that in the dependency array,
   * any unrelated re-render while the sheet was open tore the whole thing down
   * and set it up again: scroll lock off and on, key listener re-bound, and —
   * the visible one — the focus timer restarted, so focus jumped back to the
   * panel mid-typing. Nothing here reads a callback during render, so a ref is
   * the honest expression of "latest value, not a dependency".
   */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Park the page. Shared, reference-counted (see scrollLock.ts): a dialog
    // can be unmounted while open — above a chat surface holding its own lock
    // — and a private snapshot restored out of order used to leave the body
    // permanently unscrollable. The scrollbar compensation lives there too.
    const unlock = lockBodyScroll();

    /**
     * Focus, after the panel has stopped moving.
     *
     * On a coarse pointer it deliberately lands on the panel rather than on
     * the first field, and waits for the slide to finish: focusing an input
     * raises the software keyboard, and a keyboard opening mid-slide resizes
     * the visual viewport under an animating sheet — which is the single
     * worst frame-time spike a sheet on a phone can produce. Pointer devices
     * raise no keyboard, so they keep the old near-immediate hand-off into the
     * first control, which is who that behaviour was for.
     */
    const timer = window.setTimeout(
      () => {
        const target = COARSE_POINTER
          ? panelRef.current
          : panelRef.current?.querySelector<HTMLElement>(
              'input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])',
            ) ?? panelRef.current;
        target?.focus({ preventScroll: true });
      },
      COARSE_POINTER ? 260 : 40,
    );

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissibleRef.current) {
        onCloseRef.current();
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
      unlock();
      // `preventScroll` here too: returning focus to a control far down the
      // page would otherwise scroll-jump the page as the sheet slides away.
      previouslyFocused.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SCRIM}
            className={cn("absolute inset-0", BACKDROP[variant])}
            onClick={dismissible ? onClose : undefined}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            /* Transform and opacity only — never width, height or top — so
               every frame is compositor work. The phone sheet translates
               without scaling; see the performance note at the top.

               It travels its own full height rather than the 24px it used to,
               and does not fade: a sheet that appears in place while fading in
               reads as a page that is still loading, and a half-transparent
               panel over the scrim is the "background doesn't cover it" frame.
               Percentage translation costs the compositor exactly what 24px
               cost it. */
            initial={sheet ? { y: "100%" } : { opacity: 0, y: 16, scale: 0.97 }}
            animate={sheet ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={
              sheet
                ? { y: "100%", transition: SHEET_OUT }
                : { opacity: 0, y: 12, scale: 0.98, transition: SHEET_OUT }
            }
            transition={SHEET_IN}
            /* No hand-written `will-change` here on purpose: Framer sets it
               for the values it is animating and clears it on settle, and a
               permanently promoted full-width layer costs GPU memory on
               exactly the phones least able to spare it. */
            className={cn(
              // Full width below `sm` — a bottom sheet that stops short of the
              // viewport edges reads as an unfinished card, not as a sheet.
              "relative w-full",
              SIZE[size],
              PANEL[variant],
              // The home indicator's strip, given back as padding, so the last
              // row of buttons never sits under it on a phone.
              "pb-[env(safe-area-inset-bottom)] sm:pb-0",
              // `overscroll-contain` keeps a flick inside the sheet from
              // chaining to the parked page behind it, which is the stutter
              // that used to show up as "scrolling becomes janky".
              "max-h-[92dvh] overflow-y-auto overscroll-contain scroll-thin",
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
