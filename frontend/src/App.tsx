import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/stores/auth.store";
import { PUBLIC_SPEAKING_MODE } from "@/lib/config";
import { ProtectedRoute, GuestRoute } from "@/routes/guards";
import { AppLayout } from "@/components/layout/AppLayout";
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
const NotFoundPage = lazy(() =>
  import("@/features/NotFoundPage").then((m) => ({ default: m.NotFoundPage })),
);

// Temporary public speaking mode. Lazy like every other route, so with the
// flag off these chunks are never requested and the demo code stays out of the
// production bundle entirely.
const PublicSpeakingPage = lazy(() =>
  import("@/features/public-speaking/PublicSpeakingPage").then((m) => ({
    default: m.PublicSpeakingPage,
  })),
);
const DemoProfilePage = lazy(() =>
  import("@/features/public-speaking/DemoProfilePage").then((m) => ({
    default: m.DemoProfilePage,
  })),
);
const AdminLoginPage = lazy(() =>
  import("@/features/admin/AdminLoginPage").then((m) => ({ default: m.AdminLoginPage })),
);
const AdminModerationPage = lazy(() =>
  import("@/features/admin/AdminModerationPage").then((m) => ({
    default: m.AdminModerationPage,
  })),
);

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

            {/*
              Marketing mode — one demo session only.

              The two arms are mutually exclusive, so the flag is a hard switch
              rather than an overlay: with it off, not one demo route exists and
              the authenticated app below is byte-for-byte today's routing.

              The demo arm omits ProtectedRoute because its visitors have no
              account. Events and Complaints ARE routed here so visitors can see
              what Ekaton offers, but they render a Coming Soon shell and issue
              no API calls — every endpoint is IsAuthenticated, so a request
              would 401, and publishing real campus data to anonymous visitors
              would be a privacy problem. Public Speaking is the only
              interactive feature.
            */}
            {PUBLIC_SPEAKING_MODE ? (
              <>
                <Route element={<AppLayout />}>
                  {/* No auto-redirect: the landing page is Home. */}
                  <Route path="/" element={<Navigate to="/home" replace />} />
                  <Route path="/home" element={<HomePage />} />
                  <Route path="/events" element={<EventsPage />} />
                  <Route path="/complaints" element={<ComplaintsPage />} />
                  <Route path="/profile" element={<DemoProfilePage />} />
                </Route>

                {/* Full-bleed, outside the shell — same as the real chat pages. */}
                <Route path="/public-speaking" element={<PublicSpeakingPage />} />

                {/* Moderation, gated server-side by IsAdminUser. Registered only
                    in this arm because the backend registers its endpoints only
                    while the flag is on — shipping the routes to production
                    would give a page whose API returns 404. */}
                <Route path="/admin" element={<AdminLoginPage />} />
                <Route
                  path="/admin/public-speaking"
                  element={<AdminModerationPage />}
                />
              </>
            ) : (
              <>
                <Route element={<GuestRoute />}>
                  <Route path="/" element={<LandingPage />} />
                </Route>

                <Route element={<ProtectedRoute />}>
                  {/* Full-bleed chat pages — deliberately outside AppLayout. */}
                  <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
                  <Route path="/events/:id/chat" element={<EventChatPage />} />

                  <Route element={<AppLayout />}>
                    <Route path="/home" element={<HomePage />} />
                    <Route path="/events" element={<EventsPage />} />
                    <Route path="/events/:id" element={<EventDetailPage />} />
                    <Route path="/complaints" element={<ComplaintsPage />} />
                    <Route path="/complaints/:id" element={<ComplaintDetailPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                  </Route>
                </Route>
              </>
            )}

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AnimatePresence>
      </Suspense>

      {/* Auth is a modal — reachable from any screen, never a page. Demo mode
          has no login at all, so it is not mounted. */}
      {!PUBLIC_SPEAKING_MODE && <AuthModal />}
    </>
  );
}
