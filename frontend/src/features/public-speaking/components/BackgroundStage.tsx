import { Petal } from "./Pookalam";

/**
 * The page's background — four layers, almost all of them free.
 *
 * The first version of this stack (grain, ~130-path watermark SVGs in the DOM,
 * seven drifting petals under a frosted header) was cut for making the page
 * heavy. This rebuild keeps the festival and drops the cost, and the split of
 * responsibilities is the point:
 *
 *   1. `pk-wash`        — static radial gold gradients. Painted once.
 *   2. `pk-mandala`     — the pookalam watermark as CSS `data:` URIs on ONE
 *                         element: rasterised by the style system, zero DOM
 *                         nodes, unlike its 130-path ancestor.
 *   3. `pk-petal-field` — scattered static petals, same trick, one element.
 *   4. Three drifting petals — the only living layer, transform-only so they
 *                         animate on the compositor. Safe now the page has no
 *                         `backdrop-filter` for them to invalidate (the full
 *                         argument lives in pookalam.css); hidden on phones,
 *                         where the feed covers most of the viewport anyway.
 *
 * Everything is `aria-hidden` and pointer-transparent; nothing here may ever
 * compete with text — if it does, the fix is less opacity, not more contrast.
 */

/** Deterministic placements — no render-time randomness, no hydration drift. */
const DRIFTERS = [
  { left: "8%", top: "30%", size: 18, time: "26s", delay: "0s", tone: "gold" },
  { left: "88%", top: "48%", size: 14, time: "34s", delay: "-12s", tone: "amber" },
  { left: "72%", top: "82%", size: 12, time: "30s", delay: "-21s", tone: "gold" },
] as const;

export function BackgroundStage() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="pk-wash absolute inset-0" />
      <div className="pk-mandala absolute inset-0" />
      <div className="pk-petal-field absolute inset-0" />
      <div className="hidden sm:block">
        {DRIFTERS.map((petal) => (
          <span
            key={petal.left}
            className="pk-drift absolute opacity-[0.14]"
            style={{
              left: petal.left,
              top: petal.top,
              width: petal.size,
              height: petal.size * 1.4,
              ["--pk-drift-time" as string]: petal.time,
              ["--pk-delay" as string]: petal.delay,
            }}
          >
            <Petal tone={petal.tone} className="size-full" />
          </span>
        ))}
      </div>
    </div>
  );
}
