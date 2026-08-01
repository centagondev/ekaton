import { Suspense, lazy, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/stores/auth.store";
import { ProtectedRoute, GuestRoute } from "@/routes/guards";
import { AppLayout } from "@/components/layout/AppLayout";
import { BloomTransition } from "@/components/layout/BloomTransition";
import { AuthModal } from "@/features/auth/AuthModal";
import { LandingPage } from "@/features/auth/LandingPage";
import { HomePage } from "@/features/home/HomePage";
import { FullPageLoader } from "@/components/ui/Spinner";

// Route-level code splitting: the landing + home path stays in the main
// bundle; everything else loads on demand.
const PasswordSetupPage = lazy(() =>
  import("@/features/auth/PasswordSetupPage").then((m) => ({ default: m.PasswordSetupPage })),
);
const ChatRoomPage = lazy(() =>
  import("@/features/chat/ChatRoomPage").then((m) => ({ default: m.ChatRoomPage })),
);
const EventsPage = lazy(() =>
  import("@/features/events/EventsPage").then((m) => ({ default: m.EventsPage })),
);
const EventDetailPage = lazy(() =>
  import("@/features/events/EventDetailPage").then((m) => ({ default: m.EventDetailPage })),
);
const EventChatPage = lazy(() =>
  import("@/features/events/EventChatPage").then((m) => ({ default: m.EventChatPage })),
);
const ComplaintsPage = lazy(() =>
  import("@/features/complaints/ComplaintsPage").then((m) => ({ default: m.ComplaintsPage })),
);
const ComplaintDetailPage = lazy(() =>
  import("@/features/complaints/ComplaintDetailPage").then((m) => ({
    default: m.ComplaintDetailPage,
  })),
);
const ProfilePage = lazy(() =>
  import("@/features/profile/ProfilePage").then((m) => ({ default: m.ProfilePage })),
);
const PublicSpeakingPage = lazy(() =>
  import("@/features/public-speaking/PublicSpeakingPage").then((m) => ({
    default: m.PublicSpeakingPage,
  })),
);
const AdminLoginPage = lazy(() =>
  import("@/features/admin/AdminLoginPage").then((m) => ({ default: m.AdminLoginPage })),
);
const AdminLayout = lazy(() =>
  import("@/features/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })),
);
const AdminDashboardPage = lazy(() =>
  import("@/features/admin/DashboardPage").then((m) => ({
    default: m.AdminDashboardPage,
  })),
);
const AdminUsersPage = lazy(() =>
  import("@/features/admin/UsersPage").then((m) => ({ default: m.AdminUsersPage })),
);
const AdminReportsPage = lazy(() =>
  import("@/features/admin/ReportsPage").then((m) => ({
    default: m.AdminReportsPage,
  })),
);
const AdminEventsPage = lazy(() =>
  import("@/features/admin/EventsPage").then((m) => ({
    default: m.AdminEventsPage,
  })),
);
const AdminPublicSpeakingPage = lazy(() =>
  import("@/features/admin/PublicSpeakingPage").then((m) => ({
    default: m.AdminPublicSpeakingPage,
  })),
);
const NotFoundPage = lazy(() =>
  import("@/features/NotFoundPage").then((m) => ({ default: m.NotFoundPage })),
);

/**
 * Fallback for admin chunk loads, defined inline so it ships in the main
 * bundle without pulling any admin code in. It honors the persisted admin
 * theme (read directly — the admin ui module isn't loaded yet) so a dark-mode
 * reload doesn't flash a white screen.
 */
function AdminChunkFallback() {
  let dark = true;
  try {
    dark = localStorage.getItem("ekaton:admin-theme") !== "light";
  } catch {
    /* default to dark */
  }
  return (
    <div
      className="flex min-h-dvh items-center justify-center"
      style={{ backgroundColor: dark ? "#0a101d" : "#f7f8fa" }}
    >
      <span
        className="size-6 animate-spin rounded-full border-2 border-t-transparent"
        style={{ borderColor: dark ? "#33455f" : "#cbd3de", borderTopColor: "transparent" }}
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}

export default function App() {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const location = useLocation();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <>
      <Suspense fallback={<FullPageLoader />}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            {/* Email-link targets — paths fixed by the backend. */}
            <Route path="/set-password" element={<PasswordSetupPage mode="set" />} />
            <Route path="/reset-password" element={<PasswordSetupPage mode="reset" />} />

            {/* The admin portal has its own admin JWT (features/admin/api.ts),
                entirely separate from the end-user session below — reachable
                regardless of whether a visitor is logged into an Ekaton
                account. AdminLayout guards every page inside it. Cold loads
                fall back to the portal's own minimal spinner instead of the
                product's brutalist loader; once the layout is up, its internal
                Suspense handles page chunks. */}
            <Route
              path="/admin"
              element={
                <Suspense fallback={<AdminChunkFallback />}>
                  <AdminLoginPage />
                </Suspense>
              }
            />
            <Route
              element={
                <Suspense fallback={<AdminChunkFallback />}>
                  <AdminLayout />
                </Suspense>
              }
            >
              <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/reports" element={<AdminReportsPage />} />
              <Route path="/admin/events" element={<AdminEventsPage />} />
              <Route
                path="/admin/public-speaking"
                element={<AdminPublicSpeakingPage />}
              />
            </Route>

            <Route element={<GuestRoute />}>
              <Route path="/" element={<LandingPage />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              {/* Full-bleed pages — deliberately outside AppLayout. Public
                  Speaking joins this group: every feature requires login now,
                  so it is no longer a separately-reachable anonymous route. */}
              <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
              <Route path="/events/:id/chat" element={<EventChatPage />} />
              <Route path="/public-speaking" element={<PublicSpeakingPage />} />

              <Route element={<AppLayout />}>
                <Route path="/home" element={<HomePage />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/events/:id" element={<EventDetailPage />} />
                <Route path="/complaints" element={<ComplaintsPage />} />
                <Route path="/complaints/:id" element={<ComplaintDetailPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AnimatePresence>
      </Suspense>

      {/* Auth is a modal — reachable from any screen, never a page. */}
      <AuthModal />

      {/* The Onam page's entrance overlay. It has to live outside <Routes>:
          Public Speaking is a full-bleed route outside AppLayout, so mounting
          this in the shell meant the navigation it was covering unmounted it
          halfway through — the bloom would flash gold and vanish instead of
          irising open onto the new page. */}
      <BloomTransition />
    </>
  );
}
