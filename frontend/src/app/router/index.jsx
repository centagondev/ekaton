import { createBrowserRouter } from "react-router-dom";
import { RootLayout } from "../layouts/RootLayout";
import HomePage from "@/features/user-side/home/pages/HomePage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
    //   {
    //     path: "events",
    //     element: <EventsPage />,
    //   },
    //   {
    //     path: "complaints",
    //     element: <ComplaintPage />,
    //   },
    ],
  },
]);
