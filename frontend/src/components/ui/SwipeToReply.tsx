import { motion, useMotionValue, useTransform } from "framer-motion";
import { Reply } from "lucide-react";
import { cn } from "@/lib/utils";

/** How far a bubble must travel before letting go starts a reply. */
const SWIPE_TRIGGER_PX = 56;

/**
 * Drag a bubble to the right to reply to it, the way WhatsApp does.
 *
 * The arrow behind the bubble fades and grows with the drag, so the gesture
 * shows its own progress and you can tell before letting go whether it will
 * take. Dragging is locked to one axis so it never steals a scroll.
 */
export function SwipeToReply({
  enabled,
  onReply,
  className,
  children,
}: {
  enabled: boolean;
  onReply: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const x = useMotionValue(0);
  const hintOpacity = useTransform(x, [8, SWIPE_TRIGGER_PX], [0, 1]);
  const hintScale = useTransform(x, [8, SWIPE_TRIGGER_PX], [0.6, 1]);

  // The width cap is applied here in both branches. This element is the only
  // one whose parent (the message column) has a definite width, so it is the
  // only place a percentage max-width can resolve correctly.
  if (!enabled) return <div className={className}>{children}</div>;

  return (
    <div className={cn("relative", className)}>
      <motion.span
        aria-hidden
        style={{ opacity: hintOpacity, scale: hintScale }}
        className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 border-2 border-ink bg-brand-lime p-1.5"
      >
        <Reply className="size-3.5" />
      </motion.span>

      <motion.div
        drag="x"
        dragDirectionLock
        dragMomentum={false}
        style={{ x }}
        // Snaps home on release; the elastic right edge is what gives the
        // gesture its rubber-band feel without ever leaving the bubble adrift.
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.5 }}
        dragTransition={{ bounceStiffness: 620, bounceDamping: 42 }}
        onDragEnd={(_, info) => {
          if (info.offset.x >= SWIPE_TRIGGER_PX) onReply();
        }}
        className="cursor-grab touch-pan-y active:cursor-grabbing"
      >
        {children}
      </motion.div>
    </div>
  );
}
