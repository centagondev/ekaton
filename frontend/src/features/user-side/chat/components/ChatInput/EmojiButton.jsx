import { Smile } from "lucide-react";

const EmojiButton = ({ onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 w-12 items-center justify-center border-2 border-black bg-white shadow-[3px_3px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_black]"
    >
      <Smile size={20} />
    </button>
  );
};

export default EmojiButton;
