import { Flag } from "lucide-react";

const ReportButton = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-black bg-white transition hover:bg-red-50 sm:h-9 sm:w-9"
    >
      <Flag className="text-red-600" size={15} />
    </button>
  );
};

export default ReportButton;
