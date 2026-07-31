import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
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
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
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
      <span className="flex size-7 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
        E
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-gray-900">
        Ekaton <span className="font-normal text-gray-400">Admin</span>
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
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
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
          "h-8 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-900",
          "placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20",
        )}
      />
      {open && (
        <div className="absolute left-0 right-0 top-10 z-40 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {matches.map((item) => (
            <button
              key={item.to}
              type="button"
              onMouseDown={() => {
                navigate(item.to);
                setTerm("");
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <item.icon className="size-4 text-gray-400" />
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
        className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-gray-100"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
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
            className="absolute right-0 top-10 z-40 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            <div className="border-b border-gray-100 px-3 py-2.5">
              <p className="truncate text-sm font-medium text-gray-900">{name}</p>
              {admin?.email && (
                <p className="truncate text-xs text-gray-500">{admin.email}</p>
              )}
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-blue-600">
                {admin?.is_superuser ? "Superuser" : "Staff"}
              </p>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <LogOut className="size-4 text-gray-400" />
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
 * breadcrumbs / quick-nav / user menu, and the page in a soft gray canvas.
 *
 * Access control is unchanged from the old moderation page: the real check is
 * IsAdminUser on every backend call. This guard only keeps people without any
 * admin token from seeing an empty shell, and the session-expired listener
 * reacts to the server's 401/403 verdict by returning to the login screen.
 */
export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // One toast per expiry, not one per parallel failing query.
  const expiredRef = useRef(false);

  useEffect(() => {
    const onExpired = () => {
      if (expiredRef.current) return;
      expiredRef.current = true;
      toast.error("Admin session expired. Please sign in again.");
      navigate("/admin", { replace: true });
    };
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, onExpired);
    return () =>
      window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, onExpired);
  }, [navigate]);

  if (!getAdminToken()) return <Navigate to="/admin" replace />;

  const current = NAV.find((item) => location.pathname.startsWith(item.to));

  return (
    <div data-admin className="min-h-dvh bg-gray-50 text-gray-900">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-gray-200 bg-white lg:flex">
        <SidebarBrand />
        <NavLinks />
        <p className="mt-auto px-6 py-4 text-[11px] text-gray-400">
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
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 bg-gray-950/40"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
              className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-gray-200 bg-white"
            >
              <div className="flex items-center justify-between pr-3">
                <SidebarBrand />
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden"
          >
            <Menu className="size-5" />
          </button>

          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex items-center gap-1.5 text-sm">
              <li className="hidden text-gray-400 sm:block">Admin</li>
              {current && (
                <>
                  <ChevronRight
                    aria-hidden
                    className="hidden size-3.5 text-gray-300 sm:block"
                  />
                  <li className="truncate font-medium text-gray-900">
                    {current.label}
                  </li>
                </>
              )}
            </ol>
          </nav>

          <QuickNav />
          <UserMenu />
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
