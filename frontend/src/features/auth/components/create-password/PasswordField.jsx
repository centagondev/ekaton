import { Eye, EyeOff } from "lucide-react";
import { Label } from "@/shared/components/ui/label";
import InputError from "@/shared/components/app-components/InputError";

const PasswordField = ({
  label,
  name,
  register,
  error,
  placeholder = "••••••••",
  showPassword,
  onToggleVisibility,
}) => {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>

      <div className="flex items-center border-2 border-black bg-[#ECEAE5]">
        <input
          id={name}
          type={showPassword ? "text" : "password"}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent px-4 py-3 outline-none placeholder:text-gray-500 sm:px-5 sm:py-4"
          {...register(name)}
        />

        <button
          type="button"
          onClick={onToggleVisibility}
          className="flex shrink-0 items-center justify-center px-4"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {error && <InputError errors={error.message} />}
    </div>
  );
};

export default PasswordField;
