import { useState } from "react";

import ChatBanner from "../components/ChatBanner";
import ChatMessages from "../components/ChatMessages";
import TypingIndicator from "../components/TypingIndicator";
import ChatHeader from "../components/ChatHeader/ChatHeader";
import ChatInput from "../components/ChatInput/ChatInput";

const ChatPage = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "other",
      text: "Hey 👋",
      time: "10:20 AM",
    },
    {
      id: 2,
      sender: "me",
      text: "Hi!",
      time: "10:21 AM",
    },
    {
      id: 3,
      sender: "other",
      text: "How are you today?",
      time: "10:22 AM",
    },
  ]);

  const [message, setMessage] = useState("");
  const [typing] = useState(true);

  const handleSend = () => {
    if (!message.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        sender: "me",
        text: message,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);

    setMessage("");
  };

  return (
    <main className="flex h-[100dvh] flex-col bg-[#FBF9F5]">
      {/* Header */}
      <ChatHeader
        user={{
          name: "Stranger",
          online: true,
        }}
        onBack={() => window.history.back()}
        onReveal={() => {}}
        onReport={() => {}}
      />

      {/* Banner */}
      <ChatBanner
        title="YOU ARE NOW CHATTING WITH A STRANGER."
        description="Be kind and respectful."
        variant="warning"
      />

      {/* Scrollable Messages */}
      <div className="flex-1 overflow-hidden">
        <ChatMessages messages={messages} />
      </div>

      {/* Typing */}
      <TypingIndicator visible={typing} />

      {/* Input */}
      <ChatInput
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onSend={handleSend}
        onSkip={() => console.log("Skip")}
      />
    </main>
  );
};

export default ChatPage;
