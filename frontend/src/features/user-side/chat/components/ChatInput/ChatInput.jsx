import { useState } from "react";

import SkipButton from "./SkipButton";
import MessageField from "./MessageField";
import EmojiButton from "./EmojiButton";
import SendButton from "./SendButton";

const ChatInput = ({ onSend, onSkip, onTyping, onEmojiClick }) => {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (!message.trim()) return;
    onSend?.(message);
    setMessage("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <footer className="border-t-2 border-black bg-[#FBF9F5] px-3 py-2.5 sm:px-4 sm:py-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 sm:gap-3"
      >
        {/* Skip — always visible, single row */}
        <SkipButton onClick={onSkip} />

        {/* Input field — takes all remaining space */}
        <MessageField
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            onTyping?.();
          }}
          onKeyDown={handleKeyDown}
        />

        {/* Emoji — hidden on mobile to save space */}
        <div className="hidden sm:block">
          <EmojiButton onClick={onEmojiClick} />
        </div>

        {/* Send — always visible */}
        <SendButton />
      </form>
    </footer>
  );
};

export default ChatInput;
