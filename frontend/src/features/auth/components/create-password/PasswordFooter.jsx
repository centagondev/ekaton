import { Info } from "lucide-react";

const PasswordFooter = () => {
  return (
    <div className="mt-10 flex items-start gap-3 text-xs text-gray-600">
      <Info size={16} className="mt-0.5 shrink-0" />

      <p>Passwords are encrypted and never shared with third parties.</p>
    </div>
  );
};

export default PasswordFooter;
