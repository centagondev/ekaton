import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { toast } from "sonner";

import { forgotPasswordSchema } from "../validation/forgot-password.schema";

const useForgotPassword = () => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(forgotPasswordSchema),
    mode: "onBlur",
  });

  const onSubmit = async (data) => {
    try {
      console.log(data);

      // await forgotPassword(data);

      toast.success("Verification email sent successfully.");
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
