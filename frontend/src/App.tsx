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
const AdminModerationPage = lazy(() =>
  import("@/features/admin/AdminModerationPage").then((m) => ({
    default: m.AdminModerationPage,
  })),
);
const NotFoundPage = lazy(() =>
  import("@/features/NotFoundPage").then((m) => ({ default: m.NotFoundPage })),
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

            {/* Moderation has its own admin JWT (features/admin/api.ts), entirely
                separate from the end-user session below — reachable regardless
                of whether a visitor is logged into an Ekaton account. */}
            <Route path="/admin" element={<AdminLoginPage />} />
            <Route path="/admin/public-speaking" element={<AdminModerationPage />} />

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
