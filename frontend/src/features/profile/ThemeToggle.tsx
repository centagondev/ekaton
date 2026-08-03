import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { setTheme, useTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: ReadonlyArray<{
  value: Theme;
  label: string;
  Icon: typeof Sun;
}> = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

/**
 * The one place the theme can change.
 *
 * Two explicit choices rather than a switch: a switch has to imply a default,
 * and "off" is the wrong word for light. There is no "System" option on
 * purpose — the whole point of this control is that the device does not get a
 * vote, so offering one would contradict it.
 *
 * Built from the same parts as ActionRow above it — 2px ink border, hard
 * offset shadow, mono caps — so it reads as another row of the page rather
 * than a settings widget bolted on.
 */
export function ThemeToggle() {
  const theme = useTheme();

  return (
    <div className="flex w-full items-center gap-4 border-2 border-ink bg-surface p-4 shadow-brutal">
      <span
        className="flex size-10 shrink-0 items-center justify-center border-2 border-ink bg-brand-lavender"
        aria-hidden="true"
      >
        {theme === "dark" ? <Moon className="size-5" /> : <Sun className="size-5" />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block font-extrabold uppercase leading-tight tracking-wide">
          Appearance
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted">
          Saved on this device.
        </span>
      </span>

      <div
        role="radiogroup"
        aria-label="Theme"
        className="flex shrink-0 border-2 border-ink"
      >
        {OPTIONS.map(({ value, label, Icon }, index) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(value)}
              className={cn(
                "relative flex items-center gap-1.5 px-2.5 py-2 font-mono text-[10px] font-black uppercase tracking-[0.12em]",
                "transition-colors sm:px-3",
                index > 0 && "border-l-2 border-ink",
                // The highlight is a sibling behind the label, not its
                // ancestor, so the label names the fixed on-accent ink itself.
                active ? "text-on-accent" : "text-muted hover:text-ink",
              )}
            >
              {active && (
                <motion.span
                  layoutId="theme-segment"
                  transition={{ type: "spring", stiffness: 520, damping: 38 }}
                  className="absolute inset-0 bg-brand-yellow"
                />
              )}
              <Icon className="relative z-10 size-3.5" aria-hidden="true" />
              <span className="relative z-10">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
