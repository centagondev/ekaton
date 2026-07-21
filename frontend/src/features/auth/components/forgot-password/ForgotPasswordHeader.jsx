import { GraduationCap } from "lucide-react";

const ForgotPasswordHeader = () => {
  return (
    <header className="space-y-2 text-center">
      <GraduationCap className="mx-auto" size={32} />

      <h1 className="text-3xl font-black">Campus Connect</h1>

      <p className="text-xs font-bold tracking-[0.3em] text-gray-500 uppercase">
        Forgot Password
      </p>
    </header>
  );
};

export default ForgotPasswordHeader;
