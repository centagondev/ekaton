import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarDays, Home, Megaphone, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Complaint Box is deliberately absent — it is not part of the MVP, and the
 * route stays reachable by URL without being advertised here.
 */
const TABS = [
  { to: "/home", label: "Home", Icon: Home },
  { to: "/events", label: "Events", Icon: CalendarDays },
  { to: "/public-speaking", label: "Speaking", Icon: Megaphone },
  { to: "/profile", label: "Profile", Icon: UserRound },
] as const;

/**
 * Mobile primary navigation.
 *
 * Rendered inside AppLayout rather than at the app root, which is what keeps it
 * off the full-bleed chat screens — there it would sit on top of the composer.
 *
 * Hidden from `md` up, where the top navbar takes over. Both are mounted at
 * once, so the sliding highlight uses its own `layoutId`; sharing the navbar's
 * would make Framer try to animate between a visible element and a
 * `display: none` one.
 */
export function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-surface md:hidden"
      style={{
        // The bar's background extends into the home-indicator strip; only its
        // content is held above it.
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <ul className="flex h-[4.25rem] items-stretch">
        {TABS.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            {/* `end` on /home only: /events must not stay lit while the user is
                on /events/:id, but /home has no children to match. */}
            <NavLink
              to={to}
              end={to === "/home"}
              className="group relative flex size-full flex-col items-center justify-center gap-1"
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="bottom-nav-active"
                      transition={{ type: "spring", stiffness: 520, damping: 38 }}
                      className="absolute inset-x-1.5 inset-y-2 border-2 border-ink bg-brand-yellow"
                    />
                  )}

                  <Icon
                    className={cn(
                      "relative z-10 size-[1.35rem] transition-transform duration-150",
                      isActive ? "text-ink" : "text-muted",
                      // Presses register on the icon, so the whole tab reads as
                      // the button rather than just the label.
                      "group-active:scale-90",
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span
                    className={cn(
                      "relative z-10 font-mono text-[10px] font-black uppercase tracking-[0.14em]",
                      isActive ? "text-ink" : "text-muted",
                    )}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
