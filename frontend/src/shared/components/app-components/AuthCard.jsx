const AuthCard = ({ children }) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F3EF] p-6">
      <div className="w-full max-w-3xl border-[3px] border-black bg-white p-8 shadow-[8px_8px_0px_black] md:p-12">
        {children}
      </div>
    </div>
  );
};

export default AuthCard;
