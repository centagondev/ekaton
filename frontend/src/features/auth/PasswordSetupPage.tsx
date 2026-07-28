import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { parseApiError } from "@/lib/errors";
import { useUiStore } from "@/stores/ui.store";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { PageTransition } from "@/components/layout/PageTransition";

interface FormValues {
  password: string;
  confirm_password: string;
}

interface Props {
  mode: "set" | "reset";
}

/**
 * Landing target for the emailed links:
 *   FRONTEND_URL/set-password?token=…   (account activation)
 *   FRONTEND_URL/reset-password?token=… (password reset)
 * These paths are fixed by the backend — do not rename them.
 */
export function PasswordSetupPage({ mode }: Props) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const openAuthModal = useUiStore((state) => state.openAuthModal);
  const token = params.get("token");
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    defaultValues: { password: "", confirm_password: "" },
  });

  const copy =
    mode === "set"
      ? { eyebrow: "Activate account", title: "Set your password", success: "Account activated" }
      : { eyebrow: "Password reset", title: "Choose a new password", success: "Password reset" };

  const submit = form.handleSubmit(async (values) => {
    if (!token) return;
    setFormError(null);
    const payload = {
      token,
      password: values.password,
      confirm_password: values.confirm_password,
    };
    try {
      if (mode === "set") await authApi.setPassword(payload);
      else await authApi.resetPassword(payload);
      setDone(true);
    } catch (error) {
      const parsed = parseApiError(error);
      if (parsed.fields.password) {
        form.setError("password", { message: parsed.fields.password });
      } else if (parsed.fields.confirm_password) {
        form.setError("confirm_password", { message: parsed.fields.confirm_password });
      } else {
        setFormError(parsed.message);
      }
    }
  });

  const goLogin = () => {
    navigate("/");
    openAuthModal("/home");
  };

  return (
    <PageTransition className="flex min-h-dvh items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md border-2 border-ink bg-surface p-8 shadow-brutal-lg"
      >
        {!token ? (
          <div className="space-y-5 text-center">
            <div className="flex justify-center">
              <div className="border-2 border-ink bg-danger p-4 text-white shadow-brutal-sm">
                <TriangleAlert className="size-7" />
              </div>
            </div>
            <h1 className="text-2xl font-black uppercase">Invalid link</h1>
            <p className="text-sm text-muted">
              This page only works when opened from the link in your email.
            </p>
            <Button className="w-full" onClick={goLogin}>
              Back to login
            </Button>
          </div>
        ) : done ? (
          <div className="space-y-5 text-center">
            <div className="flex justify-center">
              <div className="border-2 border-ink bg-brand-lime p-4 shadow-brutal-sm">
                <CheckCircle2 className="size-7" />
              </div>
            </div>
            <h1 className="text-2xl font-black uppercase">{copy.success}</h1>
            <p className="text-sm text-muted">You can log in with your new password now.</p>
            <Button className="w-full" onClick={goLogin}>
              Go to login
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5" noValidate>
            <div className="mb-6 space-y-2">
              <p className="inline-block border-2 border-ink bg-brand-lavender px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em]">
                {copy.eyebrow}
              </p>
              <h1 className="text-3xl font-black uppercase leading-tight">{copy.title}</h1>
            </div>

            {formError && (
              <p
                role="alert"
                className="border-2 border-danger bg-danger/10 px-3 py-2 text-sm font-bold text-danger"
              >
                {formError}
              </p>
            )}

            <Field
              label="New password"
              required
              hint="At least 8 characters, not entirely numeric."
              error={form.formState.errors.password?.message ?? null}
            >
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  {...form.register("password", {
                    required: "Password is required.",
                    minLength: { value: 8, message: "Must be at least 8 characters." },
                    validate: (value) =>
                      !/^\d+$/.test(value) || "Password cannot be entirely numeric.",
                  })}
                />
              )}
            </Field>

            <Field
              label="Confirm password"
              required
              error={form.formState.errors.confirm_password?.message ?? null}
            >
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="new-password"
                  {...form.register("confirm_password", {
                    required: "Please confirm your password.",
                    validate: (value) =>
                      value === form.getValues("password") || "Passwords do not match.",
                  })}
                />
              )}
            </Field>

            <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
              Save password
            </Button>
          </form>
        )}
      </motion.div>
    </PageTransition>
  );
}
