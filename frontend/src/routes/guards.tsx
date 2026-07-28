import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";
import { FullPageLoader } from "@/components/ui/Spinner";

/**
 * Unauthenticated users are sent to the landing page with the auth modal
 * raised, preserving where they were headed — never to a separate login page.
 */
export function ProtectedRoute() {
  const { isAuthenticated, ready } = useAuthStore();
  const openAuthModal = useUiStore((state) => state.openAuthModal);
  const location = useLocation();
  const blocked = ready && !isAuthenticated;

  useEffect(() => {
    if (blocked) openAuthModal(location.pathname + location.search);
  }, [blocked, openAuthModal, location.pathname, location.search]);

  if (!ready) return <FullPageLoader />;
  if (blocked) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Landing page is for guests; signed-in users go straight to the app. */
export function GuestRoute() {
  const { isAuthenticated, ready } = useAuthStore();
  if (!ready) return <FullPageLoader />;
  if (isAuthenticated) return <Navigate to="/home" replace />;
  return <Outlet />;
}
