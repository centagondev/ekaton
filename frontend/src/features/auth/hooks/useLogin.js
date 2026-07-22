import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";

import { loginSchema } from "../validation/login.schema";
import { useAuthStore } from "../store/auth.store";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const useLogin = (email = "") => {
  const [showPassword, setShowPassword] = useState(false);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(loginSchema),
    mode: "onBlur",
    defaultValues: {
      email,
      password: "",
    },
  });

  const onSubmit = async (data) => {
    console.log(data);
    try {
      const res = await login(data);
      console.log(res);
      const { message } = res;
      toast.success(message || "login successful");
      navigate("/");
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Login failed";

      toast.error(errorMessage);
    }
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
