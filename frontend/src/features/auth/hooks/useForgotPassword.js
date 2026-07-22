import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { toast } from "sonner";

import { forgotPasswordSchema } from "../validation/forgot-password.schema";
import { useAuthStore } from "../store/auth.store";
import { useNavigate } from "react-router-dom";

const useForgotPassword = () => {
  const navigate= useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(forgotPasswordSchema),
    mode: "onBlur",
  });

const forgetPassword= useAuthStore((state)=> state.forgetPassword)
  const onSubmit = async (data) => {
    try {
      console.log(data);

      await forgetPassword(data);
      toast.success("Verification email sent successfully.");
      navigate("/forgot-password-success", {state:{...data}});
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong.");
    }
  };

  return {
    register,
    handleSubmit,
    onSubmit,
    errors,
    isSubmitting,
  };
};

export default useForgotPassword;
