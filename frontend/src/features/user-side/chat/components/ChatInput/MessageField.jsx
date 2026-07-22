const MessageField = ({
  value,
  onChange,
  placeholder = "Type your message...",
}) => {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="focus:bg-brand-lavender flex-1 border-2 border-black bg-white px-4 py-3 outline-none"
    />
  );
};

export default MessageField;
