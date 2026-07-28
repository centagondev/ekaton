import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, LogOut, Menu, UserRound, X } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/home", label: "Home" },
  { to: "/events", label: "Events" },
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

/* ------------------------------ mobile drawer ----------------------------- */

function MobileDrawer({
  open,
  onClose,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}) {
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            className="absolute inset-y-0 right-0 flex w-[min(24rem,92vw)] flex-col border-l-2 border-ink bg-surface"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <div className="flex items-center justify-between border-b-2 border-ink px-5 py-4">
              <Logo />
              <button
                onClick={onClose}
                aria-label="Close navigation"
                className="border-2 border-ink p-2 transition-all active:translate-x-[1px] active:translate-y-[1px]"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Identity block — large enough to read at a glance. */}
            <Link
              to="/profile"
              onClick={onClose}
              className="flex items-center gap-4 border-b-2 border-ink bg-raised px-5 py-5 transition-colors active:bg-brand-lavender"
            >
              <Avatar
                name={user?.full_name}
                src={user?.profile_photo}
                className="size-14 text-lg"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-black uppercase tracking-tight">
                  {user?.full_name}
                </span>
                <span className="block truncate text-xs text-muted">{user?.email}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted" />
            </Link>

            <nav className="flex-1 overflow-y-auto p-4" aria-label="Mobile">
              <ul className="space-y-2">
                {LINKS.map((link, index) => (
                  <motion.li
                    key={link.to}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.06 + index * 0.05, duration: 0.2 }}
                  >
                    <NavLink
                      to={link.to}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          // Generous hit area — this is a thumb target.
                          "flex items-center justify-between border-2 border-ink px-5 py-4 text-lg font-black uppercase tracking-tight transition-all",
                          isActive
                            ? "bg-brand-yellow shadow-brutal-sm"
                            : "bg-surface active:translate-x-[2px] active:translate-y-[2px]",
                        )
                      }
                    >
                      {link.label}
                      <ChevronRight className="size-5" />
                    </NavLink>
                  </motion.li>
                ))}
              </ul>
            </nav>

            <div className="border-t-2 border-ink p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                onClick={onLogout}
                className="flex w-full items-center justify-center gap-2 border-2 border-ink bg-danger px-5 py-3.5 text-sm font-extrabold uppercase tracking-wide text-white transition-all active:translate-x-[2px] active:translate-y-[2px]"
              >
                <LogOut className="size-4" /> Log out
              </button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ---------------------------------- navbar -------------------------------- */

export function Navbar() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // A route change should never leave the drawer hanging open.
  useEffect(() => setOpen(false), [location.pathname]);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate("/");
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b-2 border-ink bg-surface">
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

            <button
              className="border-2 border-ink p-2 transition-all active:translate-x-[1px] active:translate-y-[1px] md:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
              aria-expanded={open}
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <MobileDrawer
        open={open}
        onClose={() => setOpen(false)}
        onLogout={() => void handleLogout()}
      />
    </>
  );
}

export function GuestNavbar({ onLogin }: { onLogin: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-surface">
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
