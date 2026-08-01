import { motion } from "framer-motion";
import { ArrowRight, EyeOff, ShieldQuestion, Zap } from "lucide-react";
import { staggerContainer, staggerItem } from "@/components/layout/PageTransition";

/** Plain inline points — deliberately no cards, borders or shadows. */
const POINTS = [
  { icon: EyeOff, text: "Anonymous until both agree to reveal" },
  { icon: Zap, text: "Skip or close the tab to end the chat" },
  { icon: ShieldQuestion, text: "Report inappropriate behaviour" },
] as const;

/**
 * Shared hero for the guest landing page and the signed-in home page.
 * Sized to fill one viewport so neither page ever scrolls.
 */
export function Hero({
  onStart,
  loading = false,
  onlineCount = null,
}: {
  onStart: () => void;
  loading?: boolean;
  /** Live count from platform presence; null hides the indicator entirely. */
  onlineCount?: number | null;
}) {
  return (
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="flex w-full flex-col items-center justify-center px-4 py-2 text-center max-[359px]:py-0 sm:py-10"
    >
      <motion.p
        variants={staggerItem}
        className="mb-5 border-2 border-ink bg-surface px-4 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.25em] max-[359px]:mb-3 sm:mb-8"
      >
        Anonymous &amp; Secure
      </motion.p>

      <motion.h1
        variants={staggerItem}
        className="text-[2.6rem] font-black uppercase leading-[1.02] tracking-tight max-[359px]:text-[2.05rem] sm:text-6xl lg:text-7xl"
      >
        Meet someone{" "}
        <span className="inline-block whitespace-nowrap bg-brand-yellow px-3 shadow-brutal-sm">
          new.
        </span>
      </motion.h1>

      <motion.p
        variants={staggerItem}
        className="mt-4 max-w-md text-sm text-muted max-[359px]:mt-3 max-[359px]:text-xs sm:mt-6 sm:text-base"
      >
        Real conversations with real students, completely anonymous. No profiles,
        no pressure, just connection.
      </motion.p>

      <motion.div variants={staggerItem} className="mt-8 max-[359px]:mt-5 sm:mt-10">
        <button
          onClick={onStart}
          disabled={loading}
          className="group inline-flex items-center gap-2 border-2 border-ink bg-brand-yellow px-8 py-3.5 text-base font-extrabold uppercase tracking-wide text-ink shadow-brutal transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-brutal-sm active:translate-x-[5px] active:translate-y-[5px] active:shadow-none max-[359px]:px-6 max-[359px]:py-3 disabled:opacity-60 sm:px-10 sm:py-4"
        >
          {loading ? "Starting…" : "Start chat"}
          <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
        </button>
      </motion.div>

      {onlineCount !== null && (
        <motion.p
          variants={staggerItem}
          className="mt-5 flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em] max-[359px]:mt-4 sm:mt-6"
          aria-live="polite"
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping bg-online opacity-60" />
            <span className="relative inline-flex size-2 bg-online" />
          </span>
          {onlineCount} {onlineCount === 1 ? "student" : "students"} online
        </motion.p>
      )}

      <motion.ul
        variants={staggerItem}
        /* items-start below sm so all three icons share one left edge — with
           items-center the short third line floated inward while the two wrapped
           ones stayed left, which read as a mistake. The list as a whole is
           still centred, by the section. */
        className="mt-8 flex flex-col items-start gap-2.5 max-[359px]:mt-5 max-[359px]:gap-2 sm:mt-14 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-8 sm:gap-y-3"
      >
        {POINTS.map((point) => (
          /* Left-aligned below sm: these lines are wider than a 375px phone and
             have to wrap, and centred wrap left the icon stranded on its own at
             the far edge. From sm they sit on one line each, where start and
             centre look the same. */
          <li
            key={point.text}
            className="flex items-start gap-2 text-left font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted sm:items-center sm:text-center"
          >
            <point.icon className="mt-0.5 size-3.5 shrink-0 text-ink sm:mt-0" />
            {point.text}
          </li>
        ))}
      </motion.ul>
    </motion.section>
  );
}
