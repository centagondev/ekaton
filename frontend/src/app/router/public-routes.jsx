import HomePage from "@/features/user-side/home/pages/HomePage";
import { RootLayout } from "../layouts/RootLayout";
export const publicRoutes = {
  element: <RootLayout />,
  children: [
    {
      path: "/",
      element: <HomePage />,
    },
    {
      path: "/events",
    //   element: <EventsPage />,
    },
  ],
};
