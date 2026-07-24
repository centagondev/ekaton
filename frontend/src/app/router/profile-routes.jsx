import ProfilePage from "@/features/user-side/profile/pages/ProfilePage";
import { RootLayout } from "../layouts/RootLayout";
import ProtectedRoute from "./ProtectedRoute";

export const profileRoutes = {
  element: <ProtectedRoute />,
  children: [
    {
      element: <RootLayout />,
      children: [
        {
          path: "/profile",
          element: <ProfilePage />,
        },
      ],
    },
  ],
};
