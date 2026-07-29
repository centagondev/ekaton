import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { parseApiError } from "@/lib/errors";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { PageTransition } from "@/components/layout/PageTransition";
import { Logo } from "@/components/Logo";
import { adminApi } from "./api";

interface FormValues {
  email: string;
  password: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The way in to moderation. Deliberately bare: no signup, no password reset,
 * no "are you an admin?" hints — staff accounts are provisioned server-side.
 */
export function AdminLoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormValues>({ defaultValues: { email: "", password: "" } });

  const submit = form.handleSubmit(async (values) => {
    try {
      await adminApi.login(values);
      navigate("/admin/public-speaking", { replace: true });
    } catch (error) {
      const { status, message } = parseApiError(error);
      // The backend distinguishes "wrong password" from "not a staff account",
      // and echoing that verbatim would let anyone enumerate which addresses
      // are admins. Every 401 gets one fixed sentence.
      toast.error(status === 401 ? "Invalid email or password." : message);
    }
  });

  return (
    <PageTransition className="flex min-h-dvh items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-md border-2 border-ink bg-surface p-8 shadow-brutal-lg"
      >
        <Logo className="mb-6" />

        <p className="mb-1 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-muted">
          Restricted
        </p>
        <h1 className="mb-7 text-3xl font-black uppercase tracking-tight">
          Admin
        </h1>

        <form onSubmit={submit} className="space-y-5" noValidate>
          <Field label="Email" required error={form.formState.errors.email?.message ?? null}>
            {(id) => (
              <Input
                id={id}
                type="email"
                autoComplete="username"
                placeholder="you@campus.edu"
                autoFocus
                {...form.register("email", {
                  required: "Email is required.",
                  pattern: { value: EMAIL_PATTERN, message: "Enter a valid email address." },
                })}
              />
            )}
          </Field>

          <Field label="Password" required error={form.formState.errors.password?.message ?? null}>
            {(id) => (
              <div className="relative">
                <Input
                  id={id}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pr-11"
                  {...form.register("password", { required: "Password is required." })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            )}
          </Field>

          <Button
            type="submit"
            className="w-full"
            loading={form.formState.isSubmitting}
          >
            Log in
          </Button>
        </form>
      </motion.div>
    </PageTransition>
  );
}
