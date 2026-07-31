import { Link, NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut, UserRound } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/home", label: "Home" },
  { to: "/events", label: "Events" },
  { to: "/public-speaking", label: "Public Speaking" },
] as const;

/* --------------------------------- desktop -------------------------------- */

/**
 * Nav item with a shared-element active marker: the yellow bar is one element
 * that slides between items rather than fading in and out per link.
 */
function NavItem({ to, label }: { to: string; label: string }) {
  return (
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
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b-2 border-ink bg-surface"
        style={{
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
          <Link to="/home" aria-label="Ekaton home" className="shrink-0">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {LINKS.map((link) => (
              <NavItem key={link.to} {...link} />
            ))}
          </nav>

          {/* Pushes the account cluster to the right on every breakpoint. */}
          <div className="ml-auto flex items-center gap-2">
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

            <button
              onClick={() => void handleLogout()}
              aria-label="Log out"
              className="hidden border-2 border-transparent p-2 text-muted transition-all hover:border-ink hover:text-ink md:block"
            >
              <LogOut className="size-4" />
            </button>

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
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
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
