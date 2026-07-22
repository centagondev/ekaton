import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";

import Button from "@/shared/components/app-components/Button";

import PasswordChecklist from "../components/create-password/PasswordChecklist";
import PasswordField from "../components/create-password/PasswordField";
import PasswordFooter from "../components/create-password/PasswordFooter";

import { setPasswordSchema } from "../validation/set-password.schema";
import { useAuthStore } from "../store/auth.store";
import { useSearchParams } from "react-router-dom";

const CreatePasswordPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [searchParams]= useSearchParams()
  const token= searchParams.get("token")

const setPassword = useAuthStore((state) => state.setPassword);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(setPasswordSchema),
    mode: "onBlur",
    defaultValues: {
      password: "",
      confirm_password: "",
    },
  });

  const password = watch("password");

  const onSubmit = async (data) => {
    console.log(data);
try{
	    const res = await setPassword({
        token,
        password: data.password,
        confirm_password: data.confirm_password,
      });

	console.log(res)
}catch(err){
	console.log(err)
}

  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F5F3EF] px-4 py-8 sm:px-6 lg:px-8">
      <section className="w-full max-w-lg border-2 border-black bg-white px-6 py-8 shadow-[5px_5px_0px_black] sm:px-10 sm:py-12 md:px-14 md:py-16">
        <form onSubmit={handleSubmit(onSubmit)}>
          <PasswordField
            label="New Password"
            name="password"
            register={register}
            error={errors.password}
            showPassword={showPassword}
            onToggleVisibility={() => setShowPassword((prev) => !prev)}
          />

          <div className="mt-8 md:mt-10">
            <PasswordField
              label="Confirm Password"
              name="confirm_password"
              register={register}
              error={errors.confirm_password}
              showPassword={showConfirmPassword}
              onToggleVisibility={() => setShowConfirmPassword((prev) => !prev)}
            />
          </div>

          <div className="mt-8 md:mt-10">
            <PasswordChecklist password={password} />
          </div>

          <div className="mt-10 md:mt-12">
            <Button
              type="submit"
              title={isSubmitting ? "Creating..." : "Create Account"}
              className="w-full"
              icon={<ArrowRight />}
              disabled={isSubmitting}
            />
          </div>

          <div className="mt-8 md:mt-10">
            <PasswordFooter />
          </div>
        </form>
      </section>
    </main>
  );
};

export default CreatePasswordPage;
