import { Eye, EyeOff } from "lucide-react";
import { Label } from "@/shared/components/ui/label";
import InputError from "@/shared/components/app-components/InputError";

const PasswordField = ({
  register,
  error,
  showPassword,
  onToggleVisibility,
}) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="password">Password</Label>

      <div className="flex h-14 items-center border-2 border-black">
        <input
          id="password"
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          className="min-w-0 flex-1 px-4 outline-none"
          {...register("password")}
        />

        <button
          type="button"
          onClick={onToggleVisibility}
          className="flex h-full w-14 shrink-0 items-center justify-center"
        >
          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>

      {error && <InputError errors={error.message} />}
    </div>
  );
};

export default PasswordField;
