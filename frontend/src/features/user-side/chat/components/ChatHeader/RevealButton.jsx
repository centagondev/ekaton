const RevealButton = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="bg-brand-yellow border-2 border-black px-2.5 py-1.5 text-xs font-bold shadow-[3px_3px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_black] sm:px-4 sm:py-2 sm:text-sm"
    >
      {/* Short label on mobile, full label on desktop */}
      <span className="sm:hidden">Reveal</span>
      <span className="hidden sm:inline">Reveal Request</span>
    </button>
  );
};

export default RevealButton;
