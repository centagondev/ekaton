import { Flag } from "lucide-react";

const ReportButton = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center border-2 border-black bg-white transition hover:bg-red-50"
    >
      <Flag className="text-red-600" size={18} />
    </button>
  );
};

export default ReportButton;
