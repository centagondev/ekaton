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
  disabled = false,
  onlineCount = null,
}: {
  onStart: () => void;
  loading?: boolean;
  /** Public speaking mode makes the whole app look-but-don't-touch. */
  disabled?: boolean;
  /** Live count from platform presence; null hides the indicator entirely. */
  onlineCount?: number | null;
}) {
  return (
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="flex w-full flex-col items-center justify-center px-4 py-10 text-center"
    >
      <motion.p
        variants={staggerItem}
        className="mb-8 border-2 border-ink bg-surface px-4 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.25em]"
      >
        Anonymous &amp; Secure
      </motion.p>

      <motion.h1
        variants={staggerItem}
        className="text-5xl font-black uppercase leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl"
      >
        Meet someone{" "}
        <span className="inline-block whitespace-nowrap bg-brand-yellow px-3 shadow-brutal-sm">
          new.
        </span>
      </motion.h1>

      <motion.p variants={staggerItem} className="mt-6 max-w-md text-base text-muted">
        Real conversations with real students, completely anonymous. No profiles,
        no pressure, just connection.
      </motion.p>

      <motion.div variants={staggerItem} className="mt-10">
        <button
          onClick={onStart}
          disabled={loading || disabled}
          className="group inline-flex items-center gap-2 border-2 border-ink bg-brand-yellow px-10 py-4 text-base font-extrabold uppercase tracking-wide text-ink shadow-brutal transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-brutal-sm active:translate-x-[5px] active:translate-y-[5px] active:shadow-none disabled:opacity-60"
        >
          {disabled ? "Coming Soon" : loading ? "Starting…" : "Start chat"}
          <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
        </button>
      </motion.div>

      {onlineCount !== null && (
        <motion.p
          variants={staggerItem}
          className="mt-6 flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em]"
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
        className="mt-12 flex flex-col items-center gap-3 sm:mt-14 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-8 sm:gap-y-3"
      >
        {POINTS.map((point) => (
          <li
            key={point.text}
            className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted"
          >
            <point.icon className="size-3.5 shrink-0 text-ink" />
            {point.text}
          </li>
        ))}
      </motion.ul>
    </motion.section>
  );
}
