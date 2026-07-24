const TypingIndicator = ({ visible = false }) => {
  if (!visible) return null;

  return (
    <div className="mt-3 pb-1">
      <p className="text-sm font-medium text-black">
        typing{" "}
        <span className="inline-flex gap-[2px]">
          <span className="animate-bounce [animation-delay:0ms]">&#8226;</span>
          <span className="animate-bounce [animation-delay:150ms]">&#8226;</span>
          <span className="animate-bounce [animation-delay:300ms]">&#8226;</span>
        </span>
      </p>
    </div>
  );
};

export default TypingIndicator;
