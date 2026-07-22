import { SendHorizontal } from "lucide-react";

const SendButton = ({ onClick, disabled }) => {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="bg-brand-yellow flex h-12 w-12 items-center justify-center border-2 border-black shadow-[3px_3px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_black] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <SendHorizontal size={18} />
    </button>
  );
};

export default SendButton;
