const TypingIndicator = ({ visible = false, name = "Stranger" }) => {
  if (!visible) return null;

  return (
    <div className="px-4 pb-3">
      <div className="mx-auto flex max-w-4xl justify-start">
        <div className="flex items-center gap-3 border-2 border-black bg-white px-4 py-3 shadow-[3px_3px_0px_black]">
          <span className="text-sm font-medium">{name} is typing</span>

          <div className="flex gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-black [animation-delay:0ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-black [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-black [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
