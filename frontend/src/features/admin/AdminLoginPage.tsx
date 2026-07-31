import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { parseApiError } from "@/lib/errors";
import { AButton, AField, AInput } from "./ui";
import { adminApi, getAdminToken } from "./api";

interface FormValues {
  email: string;
  password: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The way in to the portal. Deliberately bare: no signup, no password reset,
 * no "are you an admin?" hints — staff accounts are provisioned server-side.
 */
export function AdminLoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormValues>({ defaultValues: { email: "", password: "" } });

  // A live admin session skips the form. If the token is actually stale, the
  // first dashboard request 401s and the layout returns here cleanly.
  if (getAdminToken()) return <Navigate to="/admin/dashboard" replace />;

  const submit = form.handleSubmit(async (values) => {
    try {
      await adminApi.login(values);
      navigate("/admin/dashboard", { replace: true });
    } catch (error) {
      const { status, message } = parseApiError(error);
      // The backend distinguishes "wrong password" from "not a staff account",
      // and echoing that verbatim would let anyone enumerate which addresses
      // are admins. Every 401 gets one fixed sentence.
      toast.error(status === 401 ? "Invalid email or password." : message);
    }
  });

  return (
    <div
      data-admin
      className="flex min-h-dvh items-center justify-center bg-gray-50 px-4 py-12"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <ShieldCheck className="size-5" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">
            Ekaton Admin
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign in with a staff account to continue
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <form onSubmit={submit} className="space-y-4" noValidate>
            <AField label="Email" error={form.formState.errors.email?.message}>
              {(id) => (
                <AInput
                  id={id}
                  type="email"
                  autoComplete="username"
                  placeholder="you@campus.edu"
                  autoFocus
                  {...form.register("email", {
                    required: "Email is required.",
                    pattern: {
                      value: EMAIL_PATTERN,
                      message: "Enter a valid email address.",
                    },
                  })}
                />
              )}
            </AField>

            <AField
              label="Password"
              error={form.formState.errors.password?.message}
            >
              {(id) => (
                <div className="relative">
                  <AInput
                    id={id}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    paddingClass="pl-3 pr-10"
                    {...form.register("password", {
                      required: "Password is required.",
                    })}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((previous) => !previous)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              )}
            </AField>

            <AButton
              type="submit"
              className="w-full"
              loading={form.formState.isSubmitting}
            >
              Sign in
            </AButton>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          Restricted area — all actions are logged.
        </p>
      </motion.div>
    </div>
  );
}
