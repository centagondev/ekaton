const variantStyles = {
  info: "bg-gray-200",
  success: "bg-[#CCFF00]",
};

const ChatBanner = ({ title, variant = "info" }) => {
  const bg = variantStyles[variant] ?? variantStyles.info;
  return (
    <div className="flex justify-center bg-[#FBF9F5] px-3 py-2 sm:px-4 sm:py-3">
      <div className={`border-2 border-black px-3 py-1.5 sm:px-5 sm:py-2 ${bg}`}>
        <p className="text-center text-[10px] font-black tracking-widest uppercase sm:text-xs">
          {title}
        </p>
      </div>
    </div>
  );
};

export default ChatBanner;
