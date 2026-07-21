import { CheckCircle2, Circle } from "lucide-react";

const PasswordRequirement = ({ label, passed }) => {
  return (
    <div className="flex items-center gap-2 text-[11px] tracking-wide uppercase">
      {passed ? (
        <CheckCircle2 size={14} className="text-green-600" />
      ) : (
        <Circle size={12} />
      )}

      <span>{label}</span>
    </div>
  );
};

export default PasswordRequirement;
