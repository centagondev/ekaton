import { useRef, useEffect, useState, useCallback } from "react";
import { useBlocker, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

import ChatBanner from "../components/ChatBanner";
import ChatMessages from "../components/ChatMessages";
import TypingIndicator from "../components/TypingIndicator";
import ChatHeader from "../components/ChatHeader/ChatHeader";
import ChatInput from "../components/ChatInput/ChatInput";
import ReportModal from "../components/ReportModal";

import { useChatSocket } from "../hooks/useChatSocket";
import { useChatStore } from "../store/chat.store";

// How long (ms) after last keystroke before we send typing=false
const TYPING_STOP_DELAY = 1500;

// ─────────────────────────────────────────────────────────────────────────────
// Modals
// ─────────────────────────────────────────────────────────────────────────────

const SkipModal = ({ onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
    <div className="w-full max-w-sm border-2 border-black bg-white shadow-[6px_6px_0px_black]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b-2 border-black px-5 py-4">
        <AlertTriangle size={20} className="shrink-0 text-[#FFDE00]" />
        <h2 className="text-base font-black uppercase tracking-wide">Skip Chat?</h2>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        <p className="text-sm font-medium text-gray-700">
          This will end your current conversation and match you with a{" "}
          <span className="font-bold text-black">new random stranger</span>.
          Your chat history with this person will be lost.
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 border-t-2 border-black px-5 py-4">
        <button
          id="skip-modal-cancel"
          onClick={onCancel}
          className="border-2 border-black bg-white px-5 py-2 text-sm font-bold uppercase shadow-[3px_3px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_black]"
        >
          Stay
        </button>
        <button
          id="skip-modal-confirm"
          onClick={onConfirm}
          className="border-2 border-black bg-[#FFDE00] px-5 py-2 text-sm font-bold uppercase text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_black]"
        >
          Skip &amp; Find New
        </button>
      </div>
    </div>
  </div>
);

// ── Leave Chat modal (back button / browser back) ─────────────────────────────
const LeaveChatModal = ({ onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
    <div className="w-full max-w-sm border-2 border-black bg-white shadow-[6px_6px_0px_black]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b-2 border-black px-5 py-4">
        <AlertTriangle size={20} className="shrink-0 text-red-600" />
        <h2 className="text-base font-black uppercase tracking-wide">Leave Chat?</h2>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        <p className="text-sm font-medium text-gray-700">
          Are you sure you want to leave this anonymous chat? Your current
          conversation will end and you{" "}
          <span className="font-bold text-black">won't be able to continue it</span>.
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 border-t-2 border-black px-5 py-4">
        <button
          id="leave-modal-cancel"
          onClick={onCancel}
          className="border-2 border-black bg-white px-5 py-2 text-sm font-bold uppercase shadow-[3px_3px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_black]"
        >
          Stay
        </button>
        <button
          id="leave-modal-confirm"
          onClick={onConfirm}
          className="border-2 border-black bg-red-500 px-5 py-2 text-sm font-bold uppercase text-white shadow-[3px_3px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_black]"
        >
          Leave Chat
        </button>
      </div>
    </div>
  </div>
);

const RevealConfirmModal = ({ onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
    <div className="w-full max-w-sm border-2 border-black bg-white shadow-[6px_6px_0px_black]">
      {/* Body */}
      <div className="px-6 py-6">
        <h2 className="text-base font-black uppercase tracking-wide">
          Reveal Identity Request?
        </h2>
        <p className="mt-3 text-sm font-medium text-gray-700">
          Send a reveal request? Your identity stays anonymous until it's
          accepted.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 border-t-2 border-black px-6 py-4">
        <button
          id="reveal-modal-cancel"
          onClick={onCancel}
          className="flex-1 border-2 border-black bg-white py-2.5 text-sm font-bold uppercase shadow-[3px_3px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_black]"
        >
          Cancel
        </button>
        <button
          id="reveal-modal-confirm"
          onClick={onConfirm}
          className="bg-brand-yellow flex-1 border-2 border-black py-2.5 text-sm font-bold uppercase shadow-[3px_3px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_black]"
        >
          Request
        </button>
      </div>
    </div>
  </div>
);

const RevealIncomingBanner = ({ onAccept, onReject }) => (
  <div className="border-b-2 border-black bg-[#FFDE00] px-4 py-3">
    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-bold">
        🎭 The other student wants to reveal their identity!
      </p>
      <div className="flex gap-2">
        <button
          id="reveal-accept-btn"
          onClick={onAccept}
          className="border-2 border-black bg-white px-4 py-1.5 text-xs font-bold uppercase shadow-[2px_2px_0px_black] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_black]"
        >
          Accept
        </button>
        <button
          id="reveal-reject-btn"
          onClick={onReject}
          className="border-2 border-black bg-red-500 px-4 py-1.5 text-xs font-bold uppercase text-white shadow-[2px_2px_0px_black] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_black]"
        >
          Reject
        </button>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// ChatPage
// ─────────────────────────────────────────────────────────────────────────────

const ChatPage = () => {
  const navigate = useNavigate();

  // ── Store state ───────────────────────────────────────────────────────
  const roomId = useChatStore((s) => s.roomId);
  const messages = useChatStore((s) => s.messages);
  const partnerTyping = useChatStore((s) => s.partnerTyping);
  const revealState = useChatStore((s) => s.revealState);
  const partnerRevealed = useChatStore((s) => s.partnerRevealed);
  const resetChat = useChatStore((s) => s.resetChat);

  // ── Local UI state ────────────────────────────────────────────────────
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showRevealConfirm, setShowRevealConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // ── Block browser back navigation → show Leave modal ──────────────────
  // allowNavRef: set to true before any intentional programmatic navigate()
  // so the blocker lets it through without opening the Leave modal.
  const allowNavRef = useRef(false);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !allowNavRef.current && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === "blocked") {
      setShowLeaveModal(true);
    }
  }, [blocker.state]);

  // ── Guard — if no roomId, go back to connecting ────────────────────────
  useEffect(() => {
    if (!roomId && !allowNavRef.current) {
      navigate("/connecting", { replace: true });
    }
  }, [roomId, navigate]);

  // ── Typing debounce ───────────────────────────────────────────────────
  const typingStopTimer = useRef(null);
  const isTypingRef = useRef(false);

  const messagesEndRef = useRef(null);

  // ── WebSocket ─────────────────────────────────────────────────────────
  const handleSkipReceived = useCallback(() => {
    toast("The stranger left the chat.", { icon: "👋" });
    allowNavRef.current = true;
    resetChat();
    navigate("/connecting");
  }, [navigate, resetChat]);

  const handleChatEnded = useCallback(() => {
    toast("Chat ended.", { icon: "🔚" });
    allowNavRef.current = true;
    resetChat();
    navigate("/");
  }, [navigate, resetChat]);

  const handleWsError = useCallback((msg) => {
    toast.error(msg || "Something went wrong.");
  }, []);

  const { sendMessage, sendTyping, sendRevealRequest, sendRevealResponse, sendSkip } =
    useChatSocket(roomId, {
      onSkip: handleSkipReceived,
      onEnded: handleChatEnded,
      onError: handleWsError,
    });

  // ── Auto-scroll on new messages ───────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, partnerTyping]);

  // ── Toast on reveal state changes ─────────────────────────────────────
  useEffect(() => {
    if (revealState === "sent") {
      toast("Reveal request sent! Waiting for response...", { icon: "📨" });
    }
    if (revealState === "rejected") {
      toast("Reveal request was rejected.", { icon: "🚫" });
    }
    if (revealState === "accepted" && partnerRevealed) {
      toast.success(`Identity revealed: ${partnerRevealed.full_name}`);
    }
  }, [revealState, partnerRevealed]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleSend = (text) => {
    if (!text.trim()) return;
    sendMessage(text);

    // Stop typing indicator immediately on send
    clearTimeout(typingStopTimer.current);
    if (isTypingRef.current) {
      sendTyping(false);
      isTypingRef.current = false;
    }
  };

  const handleTypingChange = () => {
    if (!isTypingRef.current) {
      sendTyping(true);
      isTypingRef.current = true;
    }
    clearTimeout(typingStopTimer.current);
    typingStopTimer.current = setTimeout(() => {
      sendTyping(false);
      isTypingRef.current = false;
    }, TYPING_STOP_DELAY);
  };

  const handleSkipConfirm = () => {
    setShowSkipModal(false);
    sendSkip();
    allowNavRef.current = true;
    resetChat();
    navigate("/connecting");
  };

  const handleLeaveConfirm = (proceedFn = null) => {
    setShowLeaveModal(false);
    sendSkip();
    allowNavRef.current = true;
    resetChat();
    if (proceedFn) {
      proceedFn(); // let the blocked back-navigation go through
    } else {
      navigate("/");
    }
  };

  const handleLeaveCancel = () => {
    setShowLeaveModal(false);
    if (blocker.state === "blocked") blocker.reset();
  };

  const handleRevealRequest = () => {
    setShowRevealConfirm(true);
  };

  const handleRevealConfirm = () => {
    setShowRevealConfirm(false);
    sendRevealRequest();
  };

  const handleRevealAccept = () => {
    sendRevealResponse("accepted");
  };

  const handleRevealReject = () => {
    sendRevealResponse("rejected");
  };

  // ── Partner display name ──────────────────────────────────────────────
  const partnerName =
    revealState === "accepted" && partnerRevealed
      ? partnerRevealed.full_name
      : "Stranger";

  // ─────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────
  return (
    <>
      <main className="flex h-[100dvh] flex-col bg-[#FBF9F5]">
        {/* Header */}
        <ChatHeader
          user={{ name: partnerName, online: true }}
          onBack={() => setShowLeaveModal(true)}
          onReveal={handleRevealRequest}
          onReport={() => setShowReportModal(true)}
        />

        {/* Reveal incoming banner — when partner requests */}
        {revealState === "received" && (
          <RevealIncomingBanner
            onAccept={handleRevealAccept}
            onReject={handleRevealReject}
          />
        )}

        {/* Revealed identity card */}
        {revealState === "accepted" && partnerRevealed && (
          <div className="border-b-2 border-black bg-[#CCFF00] px-4 py-2">
            <p className="text-xs font-black uppercase tracking-widest">
              🎉 Identity Revealed —{" "}
              <span className="normal-case font-bold">
                {partnerRevealed.full_name}
              </span>{" "}
              {partnerRevealed.batch && (
                <span className="text-gray-700">· Batch {partnerRevealed.batch}</span>
              )}
            </p>
          </div>
        )}

        {/* Banner */}
        <ChatBanner title="YOU ARE NOW CHATTING WITH A STRANGER. BE KIND." />

        {/* Scrollable messages */}
        <div className="flex-1 overflow-y-auto px-3 pt-4 pb-2 sm:px-4 sm:pt-5">
          <div className="flex flex-col gap-3 sm:gap-4">
            {messages.length === 0 && (
              <p className="mt-8 text-center text-sm font-medium text-gray-400">
                Say hi! The chat has started.
              </p>
            )}
            {messages.map((message) => (
              <ChatMessages key={message.id} message={message} />
            ))}
          </div>
          <TypingIndicator visible={partnerTyping} />
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          onSkip={() => setShowSkipModal(true)}
          onTyping={handleTypingChange}
        />
      </main>

      {/* Skip confirm modal */}
      {showSkipModal && (
        <SkipModal
          onConfirm={handleSkipConfirm}
          onCancel={() => setShowSkipModal(false)}
        />
      )}

      {/* Leave Chat modal — back button / browser back */}
      {showLeaveModal && (
        <LeaveChatModal
          onConfirm={() =>
            blocker.state === "blocked"
              ? handleLeaveConfirm(blocker.proceed)
              : handleLeaveConfirm(null)
          }
          onCancel={handleLeaveCancel}
        />
      )}

      {/* Reveal confirm modal */}
      {showRevealConfirm && (
        <RevealConfirmModal
          onConfirm={handleRevealConfirm}
          onCancel={() => setShowRevealConfirm(false)}
        />
      )}

      {/* Report modal */}
      {showReportModal && (
        <ReportModal
          roomId={roomId}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </>
  );
};

export default ChatPage;
