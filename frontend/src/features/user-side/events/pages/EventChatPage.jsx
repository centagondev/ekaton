import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Send, Smile, Users, LogOut, User } from "lucide-react";

import { useEventSocket } from "../hooks/useEventSocket";
import { useEventsStore } from "../store/events.store";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { leaveEventApi } from "../api/events.api";

function formatTime(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Leave Confirm Modal
function LeaveModal({ onConfirm, onCancel, leaving }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm border-2 border-black bg-white shadow-[8px_8px_0px_black]">
        <div className="flex items-center gap-3 border-b-2 border-black px-6 py-5">
          <div className="flex size-9 shrink-0 items-center justify-center border-2 border-black bg-red-100 shadow-[2px_2px_0px_black]">
            <LogOut className="size-4 text-red-600" />
          </div>
          <span className="text-base font-black uppercase tracking-wider text-black">
            Leave Event?
          </span>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm font-medium leading-relaxed text-gray-700">
            Are you sure you want to leave this event group? You will lose access to the group chat
            history and will need to{" "}
            <span className="font-bold text-black">rejoin to participate again</span>.
          </p>
        </div>
        <div className="mx-6 border-t-2 border-black/10" />
        <div className="flex items-stretch gap-3 px-6 py-5">
          <button
            onClick={onCancel}
            className="flex flex-1 items-center justify-center border-2 border-black bg-white px-4 py-3 font-extrabold uppercase tracking-wider text-black shadow-[3px_3px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_black] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all duration-150"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={leaving}
            className="flex flex-1 items-center justify-center border-2 border-black bg-red-500 px-4 py-3 font-extrabold uppercase tracking-wider text-white shadow-[3px_3px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_black] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {leaving ? "Leaving..." : "Leave Chat"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Message Bubble
function MessageBubble({ message, isMe }) {
  const time = formatTime(message.created_at);

  if (isMe) {
    return (
      <div className="flex items-end justify-end gap-3">
        <div className="max-w-[70%]">
          <div className="border-2 border-black bg-[#FFDE00] px-4 py-3 shadow-[2px_2px_0px_black]">
            <p className="text-sm font-medium leading-relaxed text-black">{message.content}</p>
          </div>
          <p className="mt-1 text-right text-[10px] font-medium text-gray-400">{time}</p>
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center border-2 border-black bg-[#E8EBFF] shadow-[2px_2px_0px_black]">
          <User className="size-4 text-black" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center border-2 border-black bg-gray-100 shadow-[2px_2px_0px_black]">
        <User className="size-4 text-gray-500" />
      </div>
      <div className="max-w-[70%]">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
          {message.sender_name}
        </p>
        <div className="border-2 border-black bg-white px-4 py-3 shadow-[2px_2px_0px_black]">
          <p className="text-sm font-medium leading-relaxed text-black">{message.content}</p>
        </div>
        <p className="mt-1 text-[10px] font-medium text-gray-400">{time}</p>
      </div>
    </div>
  );
}

// EventChatPage
const EventChatPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { currentEvent: event, fetchEventById } = useEventsStore();

  const [input, setInput] = useState("");
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Block ALL navigation away from the page (back button, links, etc.)
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    currentLocation.pathname !== nextLocation.pathname
  );

  // Load messages from localStorage on mount (keyed per event)
  const storageKey = `ekaton_chat_${id}`;
  const [localMessages, setLocalMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const [isTyping, setIsTyping] = useState(false);
  // Track optimistic message content to avoid duplication when WS echoes own message
  const pendingSentRef = useRef(new Set());

  const { messages: wsMessages, typingUsers, onlineCount, sendMessage, sendTypingStart, sendTypingStop, wsRef } =
    useEventSocket(id, {
      onError: () => {},
      onClose: (code) => {
        if (code === 4003) {
          toast.error("You are not a participant of this event.");
          navigate("/events");
        }
      },
    });

  // Merge real WS messages when they arrive — skip own messages that were
  // already shown optimistically (de-duplicate by checking pendingSentRef)
  useEffect(() => {
    if (wsMessages.length === 0) return;
    setLocalMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const newMsgs = [];
      for (const m of wsMessages) {
        if (existingIds.has(m.id)) continue;
        const isMe = m.sender_name === user?.full_name;
        // If it's our own message and we have a pending optimistic entry for it, skip
        if (isMe && pendingSentRef.current.has(m.content)) {
          pendingSentRef.current.delete(m.content);
          // Replace the optimistic message (temp id) with the real one from WS
          return prev.map((pm) =>
            pm.isMe && pm.isOptimistic && pm.content === m.content
              ? { ...m, isMe: true, isOptimistic: false }
              : pm
          );
        }
        newMsgs.push({ ...m, isMe });
      }
      return newMsgs.length ? [...prev, ...newMsgs] : prev;
    });
  }, [wsMessages, user?.full_name]);

  useEffect(() => {
    if (!event || String(event.id) !== String(id)) {
      fetchEventById(id).catch(() => {});
    }
  }, [id, event, fetchEventById]);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(localMessages));
    } catch {
      // storage quota exceeded — ignore
    }
  }, [localMessages, storageKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    // Track this content so we can de-dup the WS echo
    pendingSentRef.current.add(text);

    const newMsg = {
      id: `optimistic-${Date.now()}`,
      sender_name: user?.full_name || "Me",
      content: text,
      created_at: new Date().toISOString(),
      isMe: true,
      isOptimistic: true,
    };
    setLocalMessages((prev) => [...prev, newMsg]);

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendMessage(text);
    }

    setInput("");
    sendTypingStop();
    setIsTyping(false);
    clearTimeout(typingTimerRef.current);
    inputRef.current?.focus();
  }, [input, sendMessage, sendTypingStop, user?.full_name, wsRef]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (!isTyping) {
      sendTypingStart();
      setIsTyping(true);
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      sendTypingStop();
      setIsTyping(false);
    }, 2000);
  };

  // Called when user confirms leaving — from button OR back-navigation blocker
  const handleLeave = async (proceedFn = null) => {
    try {
      setLeaving(true);
      await leaveEventApi(id);
      toast.success("You left the event.");
      // If triggered by the back-navigation blocker, let the blocked navigation proceed
      if (proceedFn) {
        proceedFn();
      } else {
        navigate("/events");
      }
    } catch (err) {
      const status = err.response?.status;

      // Treat any 4xx as "effectively left" — the user is no longer a participant
      // (covers: 400 "already left", 400 "event not active", 404 "not found", etc.)
      if (status && status >= 400 && status < 500) {
        toast.success("You left the event.");
        if (proceedFn) {
          proceedFn();
        } else {
          navigate("/events");
        }
        return;
      }

      // Only a true server error (5xx / network failure) should block the user
      const errMsg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        (Array.isArray(err.response?.data?.non_field_errors)
          ? err.response.data.non_field_errors[0]
          : null) ||
        "Failed to leave event. Please try again.";

      toast.error(errMsg);
      setLeaving(false);
      setShowLeaveModal(false);
      // Reset blocker so the user can try again
      if (blocker.reset) blocker.reset();
    }
  };

  // When the back-navigation blocker fires, open the leave modal
  useEffect(() => {
    if (blocker.state === "blocked") {
      setShowLeaveModal(true);
    }
  }, [blocker.state]);

  const eventName = event?.name ?? "Event Chat";

  return (
    <div className="flex h-dvh flex-col bg-[#FBF9F5]">
      {/* Header */}
      <header className="shrink-0 border-b-2 border-black bg-white">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-black uppercase leading-tight tracking-tight text-black">
              {eventName}
            </h1>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
              <span className="inline-block size-2 rounded-full bg-emerald-500" />
              {onlineCount} Students Online
            </div>
          </div>
          <button
            onClick={() => setShowLeaveModal(true)}
            className="flex items-center gap-2 border-2 border-black bg-white px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider shadow-[3px_3px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_black] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all duration-150"
          >
            <LogOut className="size-3.5" />
            Leave Group
          </button>
        </div>
      </header>

      {/* System notice */}
      <div className="shrink-0 flex justify-center border-b-2 border-black/10 bg-[#FBF9F5] px-4 py-3">
        <span className="border-2 border-black/20 bg-white px-5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 shadow-[2px_2px_0px_rgba(0,0,0,0.08)]">
          You are now chatting with a stranger. Be kind.
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {localMessages.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
              <Users className="size-12" />
              <p className="text-sm font-bold uppercase tracking-widest">No messages yet</p>
              <p className="text-xs font-medium">Be the first to say something!</p>
            </div>
          )}

          {localMessages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} isMe={msg.isMe} />
          ))}

          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
              <div className="flex gap-1">
                <span className="inline-block size-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                <span className="inline-block size-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                <span className="inline-block size-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
              </div>
              Someone is typing...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t-2 border-black bg-white px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button className="shrink-0 text-gray-400 hover:text-black transition-colors" tabIndex={-1}>
            <Smile className="size-5" />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 border-2 border-black bg-[#FBF9F5] px-4 py-3 font-medium text-black placeholder:text-gray-400 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="shrink-0 border-2 border-black bg-[#FFDE00] px-6 py-3 font-extrabold uppercase tracking-wider shadow-[3px_3px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_black] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>

      {showLeaveModal && (
        <LeaveModal
          onConfirm={() =>
            blocker.state === "blocked"
              ? handleLeave(blocker.proceed)
              : handleLeave(null)
          }
          onCancel={() => {
            setShowLeaveModal(false);
            if (blocker.state === "blocked") blocker.reset();
          }}
          leaving={leaving}
        />
      )}
    </div>
  );
};

export default EventChatPage;
