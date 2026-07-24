import ChatPage from "@/features/user-side/chat/pages/ChatPage";
import ChatLayout from "../layouts/ChatLayout";
import ConnectingPage from "@/features/user-side/chat/pages/ConnectingPage";
import ProtectedRoute from "./ProtectedRoute";

export const chatRoutes = {
  element: <ProtectedRoute />,
  children: [
    {
      element: <ChatLayout />,
      children: [
        {
          path: "/connecting",
          element: <ConnectingPage />,
        },
        {
          path: "/chat",
          element: <ChatPage />,
        },
      ],
    },
  ],
};
