import { useState } from "react";

import SkipButton from "./SkipButton";
import MessageField from "./MessageField";
import EmojiButton from "./EmojiButton";
import SendButton from "./SendButton";

const ChatInput = ({ onSend, onSkip, onEmojiClick }) => {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (!message.trim()) return;

    onSend?.(message);

    setMessage("");
  };

  return (
    <footer className="border-t-2 border-black bg-[#FBF9F5] p-3">
      <form
        onSubmit={handleSend}
        className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center"
      >
        <SkipButton />

        <MessageField />

        <div className="flex gap-3">
          <EmojiButton />
          <SendButton />
        </div>
      </form>
    </footer>
  );
};

export default ChatInput;
