import { Lock } from "lucide-react";

const ForgotPasswordFooter = () => {
  return (
    <div className="flex items-start gap-3 text-xs leading-5 text-gray-600">
      <Lock size={16} className="mt-0.5 shrink-0" />

      <p>
        Only email addresses registered with the BootCamp authorities are
        eligible for account recovery. Your privacy and academic integrity are
        our top priorities.
      </p>
    </div>
  );
};

export default ForgotPasswordFooter;
