const MessageBubble = ({ message }) => {
  const isMine = message.sender === "me";

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      {/* 
        Mobile: max 85% width so messages don't crowd edge-to-edge
        Desktop: 70% keeps it readable on wide screens
      */}
      <div className="max-w-[85%] sm:max-w-[70%]">
        {/* Bubble */}
        <div
          className={`border-2 border-black px-3 py-2.5 sm:px-4 sm:py-3 ${
            isMine ? "bg-brand-yellow" : "bg-white"
          }`}
        >
          {/* Text */}
          {message.text && (
            <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
              {message.text}
            </p>
          )}

          {/* Image (Future) */}
          {message.image && (
            <img src={message.image} alt="" className="mt-2 max-w-full" />
          )}

          {/* File (Future) */}
          {message.file && (
            <div className="mt-2 border-2 border-black bg-gray-100 p-2 text-sm">
              📄 {message.file.name}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div
          className={`mt-0.5 text-[11px] text-gray-500 ${
            isMine ? "text-right" : "text-left"
          }`}
        >
          {message.time}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
