import { Smile } from "lucide-react";

const EmojiButton = ({ onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[42px] w-[42px] items-center justify-center border-2 border-black bg-white transition hover:bg-gray-100"
    >
      <Smile size={20} />
    </button>
  );
};

export default EmojiButton;
