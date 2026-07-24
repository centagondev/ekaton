const SendButton = ({ onClick }) => {
  return (
    <button
      type="submit"
      onClick={onClick}
      className="bg-brand-yellow shrink-0 border-2 border-black px-4 py-2 text-sm font-black uppercase tracking-widest shadow-[3px_3px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_black] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_black] sm:px-5"
    >
      SEND
    </button>
  );
};

export default SendButton;
