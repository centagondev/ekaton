const SkipButton = ({ onClick, disabled = false }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="border-2 border-black bg-white px-4 py-2 text-sm font-bold transition hover:bg-gray-100 active:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Skip
    </button>
  );
};

export default SkipButton;
