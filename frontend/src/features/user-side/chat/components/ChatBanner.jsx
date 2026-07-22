const variants = {
  info: "bg-brand-lavender border-black",
  success: "bg-brand-lime border-black",
  warning: "bg-brand-yellow border-black",
  error: "bg-red-100 border-red-500",
};

const ChatBanner = ({ title, description, variant = "info" }) => {
  return (
    <div className={`border-b-2 px-4 py-3 text-center ${variants[variant]} `}>
      <h3 className="text-sm font-black tracking-wide uppercase">{title}</h3>

      {description && (
        <p className="mt-1 text-xs text-gray-700">{description}</p>
      )}
    </div>
  );
};

export default ChatBanner;
