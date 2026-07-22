const MessageBubble = ({ message }) => {
  const isMine = message.sender === "me";

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%] sm:max-w-[75%]">
        {/* Sender Name (optional) */}
        {!isMine && message.senderName && (
          <p className="mb-1 text-xs font-semibold text-gray-500">
            {message.senderName}
          </p>
        )}

        {/* Bubble */}

        <div
          className={`rounded-lg border-2 border-black px-4 py-3 shadow-[3px_3px_0px_black] ${
            isMine ? "bg-brand-yellow" : "bg-white"
          } `}
        >
          {/* Text */}

          {message.text && (
            <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
              {message.text}
            </p>
          )}

          {/* Image (Future) */}

          {message.image && (
            <img src={message.image} alt="" className="mt-2 rounded-md" />
          )}

          {/* File (Future) */}

          {message.file && (
            <div className="mt-2 rounded border bg-gray-100 p-2">
              📄 {message.file.name}
            </div>
          )}
        </div>

        {/* Footer */}

        <div
          className={`mt-1 flex items-center gap-2 text-xs text-gray-500 ${
            isMine ? "justify-end" : "justify-start"
          }`}
        >
          <span>{message.time}</span>

          {isMine && message.status && (
            <span className="capitalize">{message.status}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
