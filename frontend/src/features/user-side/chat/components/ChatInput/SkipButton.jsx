const SkipButton = ({ onClick, disabled = false }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="border-2 border-black bg-white px-5 py-3 font-bold uppercase shadow-[3px_3px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_black] disabled:cursor-not-allowed disabled:opacity-50"
    >
      Skip
    </button>
  );
};

export default SkipButton;
