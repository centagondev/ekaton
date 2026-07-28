import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { parseApiError } from "@/lib/errors";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

type Step = "email" | "password" | "sent";

interface EmailForm {
  email: string;
}
interface PasswordForm {
  password: string;
}

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

/**
 * Single-modal auth, per spec:
 *   1. email + Continue  -> POST /accounts/check-email/
 *   2a. verified         -> same modal: email locked, password appears, login
 *   2b. not verified     -> same modal: backend message shown verbatim
 * No navigation happens at any point; the user resumes exactly where they were.
 */
export function AuthModal() {
  const { authModalOpen, redirectAfterAuth, closeAuthModal } = useUiStore();
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [serverMessage, setServerMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const emailForm = useForm<EmailForm>({ defaultValues: { email: "" } });
  const passwordForm = useForm<PasswordForm>({ defaultValues: { password: "" } });

  // Reset to a clean state every time the modal opens.
  useEffect(() => {
    if (authModalOpen) {
      setStep("email");
      setEmail("");
      setServerMessage("");
      setFormError(null);
      setShowPassword(false);
      emailForm.reset({ email: "" });
      passwordForm.reset({ password: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authModalOpen]);

  const submitEmail = emailForm.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const envelope = await authApi.checkEmail(values.email);
      setEmail(values.email);
      if (envelope.data?.is_verified) {
        setStep("password");
      } else {
        // Display the backend's response exactly as received.
        setServerMessage(envelope.message);
        setStep("sent");
      }
    } catch (error) {
      const parsed = parseApiError(error);
      if (parsed.fields.email) {
        emailForm.setError("email", { message: parsed.fields.email });
      } else {
        setFormError(parsed.message);
      }
    }
  });

  const submitPassword = passwordForm.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(email, values.password);
      closeAuthModal();
      if (redirectAfterAuth) navigate(redirectAfterAuth, { replace: true });
      else navigate("/home", { replace: true });
    } catch (error) {
      const parsed = parseApiError(error);
      if (parsed.fields.password) {
        passwordForm.setError("password", { message: parsed.fields.password });
      } else {
        setFormError(parsed.message);
      }
    }
  });

  const busy = emailForm.formState.isSubmitting || passwordForm.formState.isSubmitting;

  return (
    <Modal open={authModalOpen} onClose={closeAuthModal} title="Login">
      <AnimatePresence mode="wait" initial={false}>
        {step === "sent" ? (
          <motion.div
            key="sent"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-5 text-center"
          >
            <div className="flex justify-center">
              <div className="border-2 border-ink bg-brand-lime p-4 shadow-brutal-sm">
                <MailCheck className="size-7" />
              </div>
            </div>
            <p className="border-2 border-ink bg-raised px-4 py-3 text-sm font-bold">
              {serverMessage}
            </p>
            <p className="text-xs text-muted">
              Open the link from your inbox to set a password, then come back and log in.
            </p>
            <Button variant="secondary" className="w-full" onClick={() => setStep("email")}>
              Use a different email
            </Button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={step === "password" ? submitPassword : submitEmail}
            className="space-y-5"
            noValidate
          >
            {formError && (
              <p
                role="alert"
                className="border-2 border-danger bg-danger/10 px-3 py-2 text-sm font-bold text-danger"
              >
                {formError}
              </p>
            )}

            <Field
              label="Email"
              required
              error={emailForm.formState.errors.email?.message ?? null}
            >
              {(id) => (
                <Input
                  id={id}
                  type="email"
                  autoComplete="email"
                  placeholder="you@campus.edu"
                  autoFocus={step === "email"}
                  disabled={step === "password"}
                  {...emailForm.register("email", {
                    required: "Email is required.",
                    pattern: {
                      value: EMAIL_PATTERN,
                      message: "Enter a valid email address.",
                    },
                  })}
                />
              )}
            </Field>

            <AnimatePresence>
              {step === "password" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <Field
                    label="Password"
                    required
                    error={passwordForm.formState.errors.password?.message ?? null}
                  >
                    {(id) => (
                      <div className="relative">
                        <Input
                          id={id}
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          autoFocus
                          className="pr-11"
                          {...passwordForm.register("password", {
                            required: "Password is required.",
                          })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                        >
                          {showPassword ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </button>
                      </div>
                    )}
                  </Field>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setStep("email");
                        passwordForm.reset({ password: "" });
                        setFormError(null);
                      }}
                      className="text-xs font-bold uppercase tracking-wide text-muted hover:text-ink"
                    >
                      Change email
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await authApi.forgotPassword(email);
                          setServerMessage(
                            "If the email is registered, a password reset link has been sent.",
                          );
                          setStep("sent");
                        } catch (error) {
                          setFormError(parseApiError(error).message);
                        }
                      }}
                      className="text-xs font-bold uppercase tracking-wide text-muted hover:text-ink"
                    >
                      Forgot password?
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Button type="submit" className="w-full" loading={busy}>
              {step === "password" ? "Login" : "Continue"}
            </Button>
          </motion.form>
        )}
      </AnimatePresence>
    </Modal>
  );
}
