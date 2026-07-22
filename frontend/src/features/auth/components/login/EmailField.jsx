import { AtSign } from "lucide-react";
import { Label } from "@/shared/components/ui/label";
import InputError from "@/shared/components/app-components/InputError";

const EmailField = ({ register, error }) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="email">Your Email</Label>

      <div className="relative">
        <input
          id="email"
          type="email"
          readOnly
          placeholder="student@gmail.com"
          className="h-14 w-full border-2 border-black px-4 pr-12 outline-none"
          {...register("email")}
        />

        <AtSign
          size={20}
          className="absolute top-1/2 right-4 -translate-y-1/2 text-gray-500"
        />
      </div>

      {error && <InputError errors={error.message} />}
    </div>
  );
};

export default EmailField;
