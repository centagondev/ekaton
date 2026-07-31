import { AnimatePresence, motion } from "framer-motion";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mirrors backend/core/validators.py::StrongPasswordValidator plus the
 * MinimumLengthValidator (min_length=8) exactly — same rules, same special-
 * character set, same order the backend raises them in. This is display-only:
 * it never blocks submission and the backend remains the sole authority, but
 * a mismatch here would show a false ✓ for a password the backend still
 * rejects, so it has to stay byte-for-byte in sync with that file.
 */
const RULES = [
  { key: "length", label: "At least 8 characters", test: (pw: string) => pw.length >= 8 },
  { key: "upper", label: "One uppercase letter", test: (pw: string) => /[A-Z]/.test(pw) },
  { key: "lower", label: "One lowercase letter", test: (pw: string) => /[a-z]/.test(pw) },
  { key: "number", label: "One number", test: (pw: string) => /\d/.test(pw) },
  {
    key: "special",
    label: "One special character",
    test: (pw: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(pw),
  },
] as const;

/** For a submit-time fallback (see PasswordSetupPage's 500-with-no-body case). */
export function passwordMeetsAllRules(password: string): boolean {
  return RULES.every((rule) => rule.test(password));
}

const STRENGTH_TIERS = [
  { min: 5, label: "Strong", bar: "bg-brand-lime" },
  { min: 3, label: "Fair", bar: "bg-brand-yellow" },
  { min: 0, label: "Weak", bar: "bg-danger" },
] as const;

/**
 * One rule row: a neutral outline while unmet, a filled check once satisfied.
 * Icon/text/gap sizes step down below `sm` only — the `sm:` values here are
 * exactly what this row already rendered at before the mobile pass, so
 * tablet/desktop output is unchanged.
 */
function RequirementRow({ label, met }: { label: string; met: boolean }) {
  return (
    <li
      className="flex items-center gap-1.5 sm:gap-2.5"
      aria-label={`${label}: ${met ? "met" : "not yet met"}`}
    >
      <span
        aria-hidden="true"
        className="relative flex size-3.5 shrink-0 items-center justify-center sm:size-4"
      >
        <AnimatePresence mode="wait" initial={false}>
          {met ? (
            <motion.span
              key="met"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 24 }}
              className="flex size-3.5 items-center justify-center rounded-full bg-brand-lime sm:size-4"
            >
              <Check className="size-2.5 stroke-[3] text-ink sm:size-3" />
            </motion.span>
          ) : (
            <motion.span
              key="unmet"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 24 }}
            >
              <Circle className="size-3.5 text-muted/50 sm:size-4" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span
        className={cn(
          "text-[11px] font-medium leading-tight transition-colors duration-200 sm:text-xs sm:leading-4",
          met ? "text-ink" : "text-muted",
        )}
      >
        {label}
      </span>
    </li>
  );
}

/**
 * Live password requirements panel, shared by Account Setup and Reset
 * Password. Purely presentational — instant feedback while typing; the
 * backend still validates on submit and its message still wins if it ever
 * disagrees (see the `password` field error rendered by the parent's Field).
 */
export function PasswordRequirements({
  password,
  visible,
}: {
  password: string;
  visible: boolean;
}) {
  const metCount = RULES.filter((rule) => rule.test(password)).length;
  const allMet = metCount === RULES.length;
  const tier = STRENGTH_TIERS.find((t) => metCount >= t.min) ?? STRENGTH_TIERS.at(-1)!;

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="overflow-hidden"
        >
          <div
            className={cn(
              "mt-2 border-2 p-2.5 transition-colors duration-300 sm:p-3.5",
              allMet ? "border-ink bg-brand-lime/10" : "border-ink bg-raised",
            )}
          >
            {/* Strength bar — width and colour both track how many rules pass. */}
            <div className="mb-2 flex items-center gap-2 sm:mb-3 sm:gap-2.5">
              <div className="h-1 flex-1 overflow-hidden border border-ink/20 bg-surface sm:h-1.5">
                <motion.div
                  className={cn("h-full", tier.bar)}
                  initial={false}
                  animate={{ width: `${(metCount / RULES.length) * 100}%` }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                />
              </div>
              <span
                role="status"
                aria-live="polite"
                className={cn(
                  "font-mono text-[9px] font-bold uppercase tracking-[0.14em] sm:text-[10px]",
                  allMet ? "text-ink" : "text-muted",
                )}
              >
                {password ? tier.label : "Requirements"}
              </span>
            </div>

            {/*
              Mobile: two columns always (five rows stacked single-file was
              the single biggest source of the excess scroll this pass fixes),
              and the list collapses away entirely once every rule is met —
              the strength bar + success line below are enough context, and
              reclaiming that space is what gets Confirm Password and Save
              onto the screen without scrolling. Past `sm` this is unchanged:
              still a 2-column grid, still visible after completion, exactly
              as it rendered before this pass.
            */}
            <ul
              className={cn(
                "grid-cols-2 gap-x-2 gap-y-1 sm:gap-1.5",
                allMet ? "hidden sm:grid" : "grid",
              )}
            >
              {RULES.map((rule) => (
                <RequirementRow key={rule.key} label={rule.label} met={rule.test(password)} />
              ))}
            </ul>

            <AnimatePresence>
              {allMet && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="mt-0 flex items-center gap-1.5 pt-0 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-ink sm:mt-3 sm:border-t sm:border-ink/10 sm:pt-2.5 sm:text-[10px]"
                >
                  <Check className="size-3 stroke-[3] sm:size-3.5" />
                  Great — this password meets every requirement
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
