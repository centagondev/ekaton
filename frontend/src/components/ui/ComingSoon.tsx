import type { ReactNode } from "react";
import { motion } from "framer-motion";

/**
 * Placeholder for features that are visible but not yet interactive.
 * Used during public speaking mode, where visitors are anonymous and every
 * data-driven page would 401.
 */
export function ComingSoon({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 border-2 border-ink bg-surface px-6 py-12 text-center shadow-brutal sm:px-10 sm:py-16"
    >
      {icon && (
        <div className="flex size-14 items-center justify-center border-2 border-ink bg-brand-lavender text-ink shadow-brutal-sm">
          {icon}
        </div>
      )}

      <span className="inline-block -rotate-1 border-2 border-ink bg-brand-yellow px-3 py-1 font-mono text-[10px] font-black uppercase tracking-[0.2em]">
        Coming Soon
      </span>

      <h2 className="text-3xl font-black uppercase leading-[1.05] tracking-tight sm:text-4xl">
        {title}
      </h2>

      <p className="max-w-md text-sm leading-relaxed text-muted">{description}</p>
    </motion.div>
  );
}
