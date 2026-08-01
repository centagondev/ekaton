import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { parseApiError } from "@/lib/errors";
import {
  AButton,
  AField,
  AInput,
  ThemeToggle,
  notify,
  useAdminTheme,
} from "./ui";
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
  const [theme, toggleTheme] = useAdminTheme();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormValues>({ defaultValues: { email: "", password: "" } });

  // A live admin session skips the form. If the token is actually stale, the
  // first request refreshes or fails, and the layout returns here cleanly.
  if (getAdminToken()) return <Navigate to="/admin/dashboard" replace />;

  const submit = form.handleSubmit(async (values) => {
    try {
      await adminApi.login(values);
      navigate("/admin/dashboard", { replace: true });
    } catch (error) {
      const { status, message } = parseApiError(error);
      // The backend distinguishes "wrong password" from "not a staff account",
      // and echoing that verbatim would let anyone enumerate which addresses
      // are admins. Every generic 401 gets one fixed sentence; a suspended
      // staff account's message passes through untouched.
      notify.error(
        status === 401 && !message.toLowerCase().includes("suspended")
          ? "Invalid email or password."
          : message,
      );
    }
  });

  return (
    <div
      data-admin
      data-admin-theme={theme}
      className="relative flex min-h-dvh items-center justify-center bg-a-canvas px-4 py-12 text-a-ink"
      style={{
        paddingTop: "max(3rem, env(safe-area-inset-top))",
        paddingBottom: "max(3rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="absolute right-4 top-4">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-a-accent text-white a-elev-md">
            <ShieldCheck className="size-5" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-a-ink">
            Ekaton Admin
          </h1>
          <p className="mt-1 text-sm text-a-muted">
            Sign in with a staff account to continue
          </p>
        </div>

        <div className="rounded-xl border border-a-line bg-a-surface p-5 a-elev-md sm:p-6">
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
                    paddingClass="pl-3 pr-11"
                    {...form.register("password", {
                      required: "Password is required.",
                    })}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((previous) => !previous)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-a-faint transition-colors hover:text-a-text"
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

        <p className="mt-4 text-center text-xs text-a-faint">
          Restricted area — all actions are logged.
        </p>
      </motion.div>
    </div>
  );
}
