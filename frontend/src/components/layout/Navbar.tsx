import { Link, NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { UserRound } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/home", label: "Home" },
  { to: "/events", label: "Events" },
  // The route keeps its original path; only the name shown to people changed.
  { to: "/public-speaking", label: "Exclusive" },
] as const;

/* --------------------------------- desktop -------------------------------- */

/**
 * Nav item with a shared-element active marker: the yellow bar is one element
 * that slides between items rather than fading in and out per link.
 */
function NavItem({ to, label }: { to: string; label: string }) {
  return (
    // Every link navigates on the click, including this feature's — it used to
    // hold the route change back behind a ~430ms bloom overlay, which is time
    // the person who tapped it spends watching an animation instead of the
    // page they asked for.
    <NavLink to={to} className="group relative px-3 py-2">
      {({ isActive }) => (
        <>
          <span
            className={cn(
              "relative z-10 text-xs font-extrabold uppercase tracking-[0.1em] transition-colors",
              isActive ? "text-ink" : "text-muted group-hover:text-ink",
            )}
          >
            {label}
          </span>

          {/* Hover wash, kept behind the label. */}
          <span className="absolute inset-0 scale-95 bg-raised opacity-0 transition-all duration-150 group-hover:scale-100 group-hover:opacity-100" />

          {isActive && (
            <motion.span
              layoutId="nav-active"
              transition={{ type: "spring", stiffness: 520, damping: 38 }}
              className="absolute inset-x-2 -bottom-[3px] h-[3px] bg-brand-yellow"
            />
          )}
        </>
      )}
    </NavLink>
  );
}

/* ---------------------------------- navbar -------------------------------- */

/**
 * Top bar. From `md` up it is the primary navigation; below that it is reduced
 * to branding, because BottomNav owns wayfinding on mobile.
 */
export function Navbar() {
  const user = useAuthStore((state) => state.user);

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b-2 border-ink bg-surface"
        style={{
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        {/* Full-bleed on purpose: the bar spans the viewport while `main` stays
            in its max-w-6xl column, so the logo sits at the left edge instead of
            384px inside it on a wide display. Gutters below `lg` are unchanged,
            which keeps the mobile bar exactly as it was. */}
        <div className="flex h-16 items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          <Link to="/home" aria-label="Ekaton home" className="shrink-0">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {LINKS.map((link) => (
              <NavItem key={link.to} {...link} />
            ))}
          </nav>

          {/* On mobile the nav above is display:none, so this is the only
              other flex item and justify-between still pins it to the edge. */}
          <div className="flex items-center gap-2">
            <Link
              to="/profile"
              className="group hidden items-center gap-2.5 border-2 border-transparent py-1 pl-1 pr-3 transition-all hover:border-ink hover:bg-raised md:flex"
            >
              <Avatar
                name={user?.full_name}
                src={user?.profile_photo}
                className="size-8 border-2"
              />
              <span className="max-w-32 truncate text-xs font-extrabold uppercase tracking-[0.08em]">
                {user?.full_name?.split(" ")[0]}
              </span>
            </Link>

            {/* No logout here. It fired instantly with no confirmation one
                pixel from the profile link, and the profile page now owns
                logging out — behind a confirm dialog. */}
          </div>
        </div>
      </header>
    </>
  );
}

export function GuestNavbar({ onLogin }: { onLogin: () => void }) {
  return (
    <header
      className="sticky top-0 z-40 border-b-2 border-ink bg-surface"
      style={{
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {/* Matches Navbar's gutters so the logo doesn't jump on login. */}
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" aria-label="Ekaton home">
          <Logo />
        </Link>
        <button
          onClick={onLogin}
          className="flex items-center gap-2 border-2 border-ink bg-brand-yellow px-5 py-2.5 text-xs font-extrabold uppercase tracking-[0.1em] text-ink shadow-brutal-sm transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:translate-x-[3px] active:translate-y-[3px]"
        >
          <UserRound className="size-4" /> Login
        </button>
      </div>
    </header>
  );
}
