import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mirrors backend/core/validators.py::StrongPasswordValidator plus the
 * MinimumLengthValidator (min_length=8) exactly — same rules, same special-
 * character set, same order the backend raises them in. This is display-only:
 * it never blocks submission and the backend remains the sole authority, but
 * a mismatch here would show a false ✓ for a password the backend still
 * rejects, so it has to stay byte-for-byte in sync with that file.
 *
 * Shared by Account Setup, Reset Password and the Change Password dialog —
 * change-password runs the same validator chain server-side
 * (services.change_password → validate_password), so one panel serves all
 * three or it drifts.
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

/** Extra, caller-specific rule rows (e.g. "different from current password"). */
export interface ExtraRule {
  key: string;
  label: string;
  test: (password: string) => boolean;
}

/** For submit gates and fallbacks (see PasswordSetupPage's 500-with-no-body case). */
export function passwordMeetsAllRules(password: string): boolean {
  return RULES.every((rule) => rule.test(password));
}

/**
 * Three segments, not a smooth bar: Weak / Fair / Strong are the only states
 * the label names, so the meter draws exactly those. Strong is reserved for
 * every backend rule passing — anything the server would reject must not read
 * as strong.
 */
function tierOf(metCount: number): { score: 0 | 1 | 2 | 3; label: string; fill: string } {
  if (metCount === RULES.length) return { score: 3, label: "Strong", fill: "bg-brand-lime" };
  if (metCount >= 3) return { score: 2, label: "Fair", fill: "bg-brand-yellow" };
  if (metCount >= 1) return { score: 1, label: "Weak", fill: "bg-danger" };
  return { score: 0, label: "Weak", fill: "bg-surface" };
}

/** A brutalist checkbox: a bordered square that fills lime when satisfied. */
function RequirementRow({ label, met }: { label: string; met: boolean }) {
  return (
    <li
      className="flex items-center gap-1.5 sm:gap-2"
      aria-label={`${label}: ${met ? "met" : "not yet met"}`}
    >
      <motion.span
        aria-hidden="true"
        animate={met ? { scale: [1, 1.25, 1] } : {}}
        transition={{ duration: 0.18 }}
        className={cn(
          "flex size-3.5 shrink-0 items-center justify-center border-2 border-ink transition-colors duration-150 sm:size-4",
          met ? "bg-brand-lime" : "bg-surface",
        )}
      >
        {met && <Check className="size-2.5 stroke-[3.5] text-ink sm:size-3" />}
      </motion.span>
      <span
        className={cn(
          "font-mono text-[10px] font-bold uppercase leading-tight tracking-[0.1em] transition-colors duration-150 sm:text-[11px] sm:tracking-[0.14em]",
          met ? "text-ink" : "text-muted",
        )}
      >
        {label}
      </span>
    </li>
  );
}

/**
 * Live password requirements panel. Purely presentational — instant feedback
 * while typing; the backend still validates on submit and its message still
 * wins if it ever disagrees (see the `password` field error rendered by the
 * parent's Field).
 */
export function PasswordRequirements({
  password,
  visible,
  extraRules = [],
}: {
  password: string;
  visible: boolean;
  extraRules?: readonly ExtraRule[];
}) {
  const metCount = RULES.filter((rule) => rule.test(password)).length;
  const tier = tierOf(metCount);
  const allMet = metCount === RULES.length && extraRules.every((rule) => rule.test(password));

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
          <div className="mt-2 space-y-2.5 sm:space-y-3">
            {/* Segmented strength meter — bordered blocks in the system's own
                hard-edged language, filling as tiers are reached. */}
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1" aria-hidden="true">
                {[1, 2, 3].map((segment) => (
                  <span
                    key={segment}
                    className={cn(
                      "h-2 flex-1 border-2 border-ink transition-colors duration-200",
                      segment <= tier.score ? tier.fill : "bg-surface",
                    )}
                  />
                ))}
              </div>
              {/* Fixed width so Weak → Strong never nudges the bars. */}
              <span
                role="status"
                aria-live="polite"
                className={cn(
                  "w-14 text-right font-mono text-[10px] font-bold uppercase tracking-[0.14em]",
                  allMet ? "text-ink" : "text-muted",
                )}
              >
                {password ? tier.label : ""}
              </span>
            </div>

            <div
              className={cn(
                "border-2 border-ink p-2.5 transition-colors duration-300 sm:p-3",
                allMet ? "bg-brand-lime/10" : "bg-raised",
              )}
            >
              {/*
                Mobile: two columns always (five rows stacked single-file was
                the single biggest source of excess scroll), and the list
                collapses away once every rule is met — the meter + success
                line are enough context, and reclaiming that space is what
                keeps Confirm and Save on screen. Past `sm` the list stays
                visible after completion.
              */}
              <ul
                className={cn(
                  "grid-cols-2 gap-x-2 gap-y-1.5 sm:gap-y-2",
                  allMet ? "hidden sm:grid" : "grid",
                )}
              >
                {RULES.map((rule) => (
                  <RequirementRow key={rule.key} label={rule.label} met={rule.test(password)} />
                ))}
                {extraRules.map((rule) => (
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
                    className="mt-0 flex items-center gap-1.5 pt-0 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-ink sm:mt-2.5 sm:border-t sm:border-ink/10 sm:pt-2.5 sm:text-[10px]"
                  >
                    <Check className="size-3 stroke-[3]" />
                    Great — this password meets every requirement
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
