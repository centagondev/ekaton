const MessageField = ({
  value,
  onChange,
  onKeyDown,
  placeholder = "Type a message...",
}) => {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      autoComplete="off"
      className="flex-1 min-w-0 border-2 border-black bg-white px-3 py-2 text-sm outline-none focus:bg-[#F5F3FF] sm:px-4"
    />
  );
};

export default MessageField;
