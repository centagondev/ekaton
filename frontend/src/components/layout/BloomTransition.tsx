import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { EASE_OUT_EXPO, useMotionPrefs } from "@/lib/motion";
import { Petal } from "@/features/public-speaking/components/Pookalam";
import { useBloomStore } from "./bloom.store";

/**
 * The Pookalam Bloom — the transition into the Onam page.
 *
 * From the click point a gold bloom expands with a ring of petals riding it,
 * covers the screen, and then irises open from the centre to reveal the page
 * underneath. It is the transition-scale expression of the same motif that
 * assembles in the loader and bursts out of the heart.
 *
 * It is not decoration bolted onto a fast navigation. The Onam route is
 * lazy-loaded and its discussion query fires on mount, so there is a real wait
 * here; the bloom is timed to cover it. The route change is dispatched at the
 * covered peak, so the iris opens onto a page that has already begun loading
 * rather than onto a white flash.
 *
 * Hard ceiling of ~1.15s, and nothing about this is load-bearing: if the
 * overlay never mounts, the links still navigate. Under reduced motion the
 * whole thing is replaced with a 250ms crossfade.
 */

/** When the screen is covered and it is safe to swap routes. */
const COVER_MS = 430;
/** How long the iris takes to open once the route has changed. */
const IRIS_MS = 700;

/** Petals riding the leading edge of the bloom. */
const RING = Array.from({ length: 10 }, (_, index) => ({
  angle: (360 / 10) * index + 12,
  delay: index * 0.012,
}));

export function BloomTransition() {
  const origin = useBloomStore((state) => state.origin);
  const clear = useBloomStore((state) => state.clear);
  const navigate = useNavigate();
  const { reduced } = useMotionPrefs();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!origin) {
      setOpen(false);
      return;
    }

    // Reduced motion: no ceremony, just a short veil over the route change.
    if (reduced) {
      const swap = window.setTimeout(() => navigate(origin.to), 120);
      const done = window.setTimeout(clear, 250);
      return () => {
        window.clearTimeout(swap);
        window.clearTimeout(done);
      };
    }

    const swap = window.setTimeout(() => {
      navigate(origin.to);
      // One frame after the route change, so the iris starts against the new
      // tree rather than racing it.
      requestAnimationFrame(() => setOpen(true));
    }, COVER_MS);
    const done = window.setTimeout(clear, COVER_MS + IRIS_MS + 40);

    return () => {
      window.clearTimeout(swap);
      window.clearTimeout(done);
    };
  }, [origin, reduced, navigate, clear]);

  return (
    <AnimatePresence>
      {origin && (
        <motion.div
          key="bloom"
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[60]"
          initial={{ opacity: reduced ? 0 : 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.18 } }}
        >
          {reduced ? (
            <div className="absolute inset-0 bg-cream" />
          ) : (
            <div
              className="pk-iris absolute inset-0"
              data-open={open}
              style={{
                ["--pk-ox" as string]: `${origin.x}px`,
                ["--pk-oy" as string]: `${origin.y}px`,
              }}
            >
              {/* The bloom itself. Two gentle pulses in the scale curve — a
                  chenda rhythm expressed as easing, no audio involved. */}
              <motion.span
                className="absolute block rounded-full"
                style={{
                  left: origin.x,
                  top: origin.y,
                  width: 40,
                  height: 40,
                  marginLeft: -20,
                  marginTop: -20,
                  background:
                    "radial-gradient(circle, var(--color-festival-gold) 0%, var(--color-festival-gold) 58%, var(--color-amber-deep) 100%)",
                }}
                initial={{ scale: 0 }}
                animate={{ scale: [0, 26, 34, 130] }}
                transition={{
                  duration: COVER_MS / 1000,
                  times: [0, 0.42, 0.6, 1],
                  ease: EASE_OUT_EXPO,
                }}
              />

              {/* A kasavu disc a beat behind, so the gold has depth rather
                  than being one flat fill. */}
              <motion.span
                className="absolute block rounded-full bg-kasavu"
                style={{
                  left: origin.x,
                  top: origin.y,
                  width: 40,
                  height: 40,
                  marginLeft: -20,
                  marginTop: -20,
                }}
                initial={{ scale: 0, opacity: 0.85 }}
                animate={{ scale: 130, opacity: 0.9 }}
                transition={{ duration: 0.5, delay: 0.16, ease: EASE_OUT_EXPO }}
              />

              {/* Petals riding the leading edge. */}
              {RING.map((petal, index) => {
                const radians = (petal.angle * Math.PI) / 180;
                return (
                  <motion.span
                    key={index}
                    className="absolute block"
                    style={{
                      left: origin.x,
                      top: origin.y,
                      width: 22,
                      height: 32,
                      marginLeft: -11,
                      marginTop: -16,
                    }}
                    initial={{ x: 0, y: 0, scale: 0.3, opacity: 0, rotate: petal.angle }}
                    animate={{
                      x: Math.cos(radians) * 460,
                      y: Math.sin(radians) * 460,
                      scale: 2.4,
                      opacity: [0, 1, 0],
                      rotate: petal.angle + 160,
                    }}
                    transition={{ duration: 0.72, delay: petal.delay, ease: EASE_OUT_EXPO }}
                  >
                    <Petal tone={index % 3 === 0 ? "cream" : "gold"} className="size-full" />
                  </motion.span>
                );
              })}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
