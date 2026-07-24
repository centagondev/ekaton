import { RootLayout } from "../layouts/RootLayout";
import ProtectedRoute from "./ProtectedRoute";
import EventsPage from "@/features/user-side/events/pages/EventsPage";
import EventDetailPage from "@/features/user-side/events/pages/EventDetailPage";
import EventChatPage from "@/features/user-side/events/pages/EventChatPage";

export const eventRoutes = {
  element: <ProtectedRoute />,
  children: [
    {
      element: <RootLayout />,
      children: [
        {
          path: "/events",
          element: <EventsPage />,
        },
        {
          path: "/events/:id",
          element: <EventDetailPage />,
        },
      ],
    },
    // Event chat has its own full-screen layout (no Navbar)
    {
      path: "/events/:id/chat",
      element: <EventChatPage />,
    },
  ],
};
