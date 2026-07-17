import { ChevronLeft } from "lucide-react";

const BackButton = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center border-2 border-black bg-white transition hover:bg-gray-100"
    >
      <ChevronLeft size={20} />
    </button>
  );
};

export default BackButton;
