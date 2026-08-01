import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
/** Where a double-tap lands when zooming in from rest. */
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;

interface Transform {
  scale: number;
  x: number;
  y: number;
}

const REST: Transform = { scale: 1, x: 0, y: 0 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Compact photo preview.
 *
 * A small centred card rather than a full-screen takeover: a profile photo is
 * something you glance at, and filling the viewport to do that is heavy. The
 * card caps at ~340–380px on desktop and keeps a comfortable margin on mobile.
 *
 * The card doubles as a viewport for the gesture layer — pinch, drag, wheel and
 * double-tap magnify the photo *inside* the frame, so zooming never grows the
 * modal. The mount animation lives on the wrapper and the gesture transform on
 * the image, because Framer Motion writes `style.transform` itself and the two
 * cannot share an element.
 */
export function ImageViewer({
  open,
  src,
  alt = "",
  caption,
  action,
  onClose,
}: {
  open: boolean;
  src: string | null;
  alt?: string;
  caption?: string;
  /** Optional control rendered under the photo — e.g. "Change photo". */
  action?: ReactNode;
  onClose: () => void;
}) {
  const [transform, setTransform] = useState<Transform>(REST);
  /** True while any pointer is down — drops the CSS transition so drag tracks 1:1. */
  const [interacting, setInteracting] = useState(false);

  /** Live pointers by id — two of them means a pinch is in progress. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  /** Pinch baseline: finger spread and scale at the moment it started. */
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const lastTap = useRef(0);
  /** Distinguishes a clean tap from the release of a drag or pinch. */
  const moved = useRef(false);

  const reset = useCallback(() => {
    pointers.current.clear();
    pinchStart.current = null;
    panStart.current = null;
    moved.current = false;
    setInteracting(false);
    setTransform(REST);
  }, []);

  // Escape to close, plus a scroll lock — the page behind must stay put.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Capture phase + stopPropagation so Escape closes only the topmost
      // layer. The viewer can sit above a Modal, whose own document-level
      // Escape handler would otherwise fire in the same keypress and dismiss
      // both at once.
      event.stopPropagation();
      onClose();
    };

    document.addEventListener("keydown", onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  // Every visit starts at rest rather than wherever the last one was left.
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    moved.current = false;
    setInteracting(true);

    if (pointers.current.size === 2) {
      pinchStart.current = { distance: spread(), scale: transform.scale };
      panStart.current = null;
      return;
    }

    if (transform.scale > MIN_SCALE) {
      panStart.current = {
        x: event.clientX,
        y: event.clientY,
        tx: transform.x,
        ty: transform.y,
      };
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      moved.current = true;
      const ratio = spread() / pinchStart.current.distance;
      const scale = clamp(pinchStart.current.scale * ratio, MIN_SCALE, MAX_SCALE);
      // Snapping back to centre at 1x stops the image drifting inside the
      // frame when the user pinches all the way out.
      setTransform((current) => (scale === MIN_SCALE ? REST : { ...current, scale }));
      return;
    }

    const start = panStart.current;
    if (start) {
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
      setTransform((current) => ({ ...current, x: start.tx + dx, y: start.ty + dy }));
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);

    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) {
      panStart.current = null;
      setInteracting(false);
    }
  };

  /** Double-tap inside the frame toggles between fit and magnified. */
  const consumeDoubleTap = () => {
    const now = Date.now();
    const isDouble = now - lastTap.current < DOUBLE_TAP_MS;
    lastTap.current = now;

    if (!isDouble) return;
    lastTap.current = 0;
    setTransform((current) =>
      current.scale > MIN_SCALE ? REST : { ...REST, scale: DOUBLE_TAP_SCALE },
    );
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const next = clamp(transform.scale - event.deltaY * 0.002, MIN_SCALE, MAX_SCALE);
    setTransform((current) => (next === MIN_SCALE ? REST : { ...current, scale: next }));
  };

  const zoomed = transform.scale > MIN_SCALE;

  return createPortal(
    <AnimatePresence>
      {open && src && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          role="dialog"
          aria-modal="true"
          aria-label={alt || caption || "Photo"}
          // Dimmed hard, so the page reads as context rather than content.
          // Deliberately a flat scrim rather than a blur: a `backdrop-filter`
          // over the whole viewport makes the browser re-blur everything
          // behind it on every frame this layer's opacity moves — including
          // every frame of a pinch or drag on the photo above it — which is
          // what made the viewer stutter on phones. Carrying the black a
          // little deeper separates the card just as well for nothing.
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-5 sm:p-8"
          // Anywhere outside the card closes.
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
            className="relative flex w-full max-w-[340px] flex-col items-center gap-3 sm:max-w-[380px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className={cn(
                "relative w-full overflow-hidden rounded-2xl bg-black/40",
                "shadow-2xl shadow-black/60 ring-1 ring-white/10",
                // touch-none hands every gesture to the handlers below;
                // without it the browser claims the pinch for page zoom.
                "touch-none select-none",
                zoomed ? (interacting ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in",
              )}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
              onClick={() => {
                // A click that ended a drag is not a tap — counting it would
                // let two quick pans read as a double-tap.
                if (!moved.current) consumeDoubleTap();
              }}
            >
              <img
                src={src}
                alt={alt}
                referrerPolicy="no-referrer"
                draggable={false}
                // Aspect ratio is preserved and the source is never
                // transformed, so this is the photo as uploaded — capped, not
                // cropped or stretched.
                className="block max-h-[60vh] w-full object-contain"
                style={{
                  transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
                  transition: interacting ? "none" : "transform 0.2s ease-out",
                }}
              />

              {/* Inside the frame's top-right, so it is always on screen and
                  never pushed off by a tall or narrow photo. */}
              <button
                type="button"
                // The gesture layer on the card calls setPointerCapture, and a
                // captured pointer retargets the follow-up click to the capture
                // element — so this button's onClick never ran. Keeping its own
                // pointerdown from reaching the card means no capture is taken
                // and the click lands here, on both mouse and touch.
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  // Also keep it clear of the card's double-tap handler.
                  event.stopPropagation();
                  onClose();
                }}
                aria-label="Close photo"
                autoFocus
                className={cn(
                  // z-10 keeps it above the image even while the image is
                  // scaled up by a pinch.
                  "absolute right-2 top-2 z-10 grid size-9 place-items-center rounded-full",
                  "bg-black/55 text-white backdrop-blur-sm transition-colors",
                  "hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                )}
              >
                <X className="size-4.5" />
              </button>
            </div>

            {caption && (
              <p className="max-w-full truncate text-center text-sm font-extrabold uppercase tracking-wide text-white/90">
                {caption}
              </p>
            )}

            {/* Whatever the owner of the photo can do with it — the profile's
                "change photo" lives here now that the avatar itself carries no
                badge over the picture. */}
            {action}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
