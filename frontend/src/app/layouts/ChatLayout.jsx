import { Outlet } from "react-router-dom";

const ChatLayout = () => {
  return (
    <main className="min-h-dvh bg-[#FBF9F5]">
      <Outlet />
    </main>
  );
};

export default ChatLayout;
