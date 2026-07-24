import { RootLayout } from "../layouts/RootLayout";
import ProtectedRoute from "./ProtectedRoute";
import ComplaintBoxPage from "@/features/user-side/complaints/pages/ComplaintBoxPage";
import NotificationsPage from "@/features/user-side/notifications/pages/NotificationsPage";

export const miscRoutes = {
  element: <ProtectedRoute />,
  children: [
    {
      element: <RootLayout />,
      children: [
        {
          path: "/complaints",
          element: <ComplaintBoxPage />,
        },
        {
          path: "/notifications",
          element: <NotificationsPage />,
        },
      ],
    },
  ],
};
