const RevealButton = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="bg-brand-yellow border-2 border-black px-4 py-2 text-xs font-bold uppercase shadow-[3px_3px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_black]"
    >
      Reveal Request
    </button>
  );
};

export default RevealButton;
