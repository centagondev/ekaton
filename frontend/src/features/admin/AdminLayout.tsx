import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  ChevronRight,
  Flag,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Search,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn, initialsOf } from "@/lib/utils";
import {
  ADMIN_SESSION_EXPIRED_EVENT,
  clearAdminSession,
  getAdminToken,
  getAdminUser,
} from "./api";
import { AdminPageLoader, ThemeToggle, notify, useAdminTheme } from "./ui";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/reports", label: "Reports", icon: Flag },
  { to: "/admin/events", label: "Events", icon: CalendarDays },
  { to: "/admin/public-speaking", label: "Public Speaking", icon: Megaphone },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5 px-3" aria-label="Admin sections">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors lg:min-h-9",
              isActive
                ? "bg-a-accent-soft text-a-accent-text"
                : "text-a-muted hover:bg-a-raised hover:text-a-ink",
            )
          }
        >
          <item.icon className="size-4 shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarBrand() {
  return (
    <Link
      to="/admin/dashboard"
      className="flex items-center gap-2.5 px-6 py-5"
      aria-label="Ekaton admin home"
    >
      <span className="flex size-7 items-center justify-center rounded-lg bg-a-accent text-sm font-bold text-white a-elev">
        E
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-a-ink">
        Ekaton <span className="font-normal text-a-faint">Admin</span>
      </span>
    </Link>
  );
}

/**
 * Quick navigation — type a section name, jump to it. There is no global
 * search API to call, so this searches what actually exists client-side: the
 * portal's own sections. Enter opens the first match.
 */
function QuickNav() {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [focused, setFocused] = useState(false);

  const matches = useMemo(() => {
    const query = term.trim().toLowerCase();
    if (!query) return [];
    return NAV.filter((item) => item.label.toLowerCase().includes(query));
  }, [term]);

  const open = focused && matches.length > 0;

  return (
    <div className="relative hidden w-64 md:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-a-faint" />
      <input
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && matches[0]) {
            navigate(matches[0].to);
            setTerm("");
          }
        }}
        placeholder="Go to section…"
        aria-label="Go to admin section"
        className={cn(
          "a-search h-9 w-full rounded-lg border border-a-line bg-a-raised/70 pl-9 pr-3 text-sm text-a-ink transition-colors",
          "placeholder:text-a-faint hover:border-a-line-strong",
          "focus:border-a-accent focus:bg-a-surface focus:outline-none focus:ring-2 focus:ring-a-accent-soft",
        )}
      />
      {open && (
        <div className="absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-lg border border-a-line bg-a-surface py-1 a-elev-md">
          {matches.map((item) => (
            <button
              key={item.to}
              type="button"
              onMouseDown={() => {
                navigate(item.to);
                setTerm("");
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-a-text transition-colors hover:bg-a-raised"
            >
              <item.icon className="size-4 text-a-faint" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const admin = getAdminUser();
  const name = admin?.full_name || "Administrator";

  const logout = () => {
    clearAdminSession();
    navigate("/admin", { replace: true });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex size-10 items-center justify-center rounded-lg transition-colors hover:bg-a-raised sm:size-9"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-a-accent text-xs font-semibold text-white">
          {initialsOf(name)}
        </span>
      </button>

      {open && (
        <>
          {/* click-away layer */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 top-11 z-40 w-56 overflow-hidden rounded-xl border border-a-line bg-a-surface py-1 a-elev-md"
          >
            <div className="border-b border-a-line px-3 py-2.5">
              <p className="truncate text-sm font-medium text-a-ink">{name}</p>
              {admin?.email && (
                <p className="truncate text-xs text-a-muted">{admin.email}</p>
              )}
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-a-accent-text">
                {admin?.is_superuser ? "Superuser" : "Staff"}
              </p>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm text-a-text transition-colors hover:bg-a-raised"
            >
              <LogOut className="size-4 text-a-faint" />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The portal shell: fixed sidebar on desktop, drawer on mobile, topbar with
 * breadcrumbs / quick-nav / theme toggle / user menu, and the page on the
 * themed canvas. Lazy page chunks resolve inside the shell, so navigation
 * shows the small spinner in place instead of blanking the chrome.
 *
 * Access control is unchanged: the real check is IsAdminUser on every backend
 * call. This guard only keeps people without any admin token from seeing an
 * empty shell, and the session-expired listener reacts to the server's
 * 401/403 verdict by returning to the login screen.
 */
export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, toggleTheme] = useAdminTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // One toast per expiry, not one per parallel failing query.
  const expiredRef = useRef(false);

  useEffect(() => {
    const onExpired = () => {
      if (expiredRef.current) return;
      expiredRef.current = true;
      notify.error("Session expired", "Please sign in again to continue.");
      navigate("/admin", { replace: true });
    };
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, onExpired);
    return () =>
      window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, onExpired);
  }, [navigate]);

  if (!getAdminToken()) return <Navigate to="/admin" replace />;

  const current = NAV.find((item) => location.pathname.startsWith(item.to));

  return (
    <div
      data-admin
      data-admin-theme={theme}
      className="min-h-dvh bg-a-canvas text-a-ink"
    >
      {/* desktop sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-a-line bg-a-surface lg:flex"
        style={{ paddingLeft: "env(safe-area-inset-left)" }}
      >
        <SidebarBrand />
        <NavLinks />
        <p className="mt-auto px-6 py-4 text-[11px] text-a-faint">
          Ekaton moderation &amp; administration
        </p>
      </aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.button
              type="button"
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: "linear" }}
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 bg-black/50"
            />
            <motion.aside
              initial={{ x: -288 }}
              animate={{ x: 0 }}
              exit={{ x: -288 }}
              transition={{ type: "tween", duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
              className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-a-line bg-a-surface a-elev-lg"
              style={{
                // Transform-only slide with a compositor hint — no layout or
                // paint work per frame, which is what the drawer was paying for.
                willChange: "transform",
                paddingLeft: "env(safe-area-inset-left)",
                paddingTop: "env(safe-area-inset-top)",
              }}
            >
              <div className="flex items-center justify-between pr-3">
                <SidebarBrand />
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-lg p-2.5 text-a-faint transition-colors hover:bg-a-raised hover:text-a-text"
                >
                  <X className="size-4" />
                </button>
              </div>
              <NavLinks onNavigate={() => setDrawerOpen(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* topbar + page */}
      <div className="lg:pl-60">
        <header
          className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-a-line bg-a-surface px-3 sm:gap-3 sm:bg-a-surface/85 sm:px-6 sm:backdrop-blur"
          style={{
            paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
            paddingRight: "max(0.75rem, env(safe-area-inset-right))",
          }}
        >
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            className="-ml-1 rounded-lg p-2.5 text-a-muted transition-colors hover:bg-a-raised hover:text-a-ink lg:hidden"
          >
            <Menu className="size-5" />
          </button>

          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex items-center gap-1.5 text-sm">
              <li className="hidden text-a-faint sm:block">Admin</li>
              {current && (
                <>
                  <ChevronRight
                    aria-hidden
                    className="hidden size-3.5 text-a-line-strong sm:block"
                  />
                  <li className="truncate font-medium text-a-ink">
                    {current.label}
                  </li>
                </>
              )}
            </ol>
          </nav>

          <QuickNav />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <UserMenu />
        </header>

        <main
          className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8"
          style={{
            paddingLeft: "max(1rem, env(safe-area-inset-left))",
            paddingRight: "max(1rem, env(safe-area-inset-right))",
            paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
          }}
        >
          {/* Lazy admin pages resolve here — chrome stays, content spins. */}
          <Suspense fallback={<AdminPageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
