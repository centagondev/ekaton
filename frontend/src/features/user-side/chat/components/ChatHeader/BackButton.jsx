import { ChevronLeft } from "lucide-react";

const BackButton = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-black bg-white transition hover:bg-gray-100 sm:h-10 sm:w-10"
    >
      <ChevronLeft size={18} className="sm:hidden" />
      <ChevronLeft size={20} className="hidden sm:block" />
    </button>
  );
};

export default BackButton;
