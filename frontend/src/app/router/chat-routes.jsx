import ChatPage from "@/features/user-side/chat/pages/ChatPage";
import ChatLayout from "../layouts/ChatLayout";
import ConnectingPage from "@/features/user-side/chat/pages/ConnectingPage";

export const chatRoutes = {
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
};
