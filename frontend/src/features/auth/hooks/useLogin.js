import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";

import { loginSchema } from "../validation/login.schema";

const useLogin = () => {
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(loginSchema),
    mode: "onBlur",
  });

  const onSubmit = async (data) => {
    console.log(data);

    // await login(data)
  };

  return {
    register,
    handleSubmit,
    errors,
    isSubmitting,
    onSubmit,
    showPassword,
    togglePassword: () => setShowPassword((prev) => !prev),
  };
};

export default useLogin;
