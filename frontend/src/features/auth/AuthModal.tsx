import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { AnimatePresence, motion } from "framer-motion";
import { MailCheck } from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { parseApiError } from "@/lib/errors";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { COARSE_POINTER } from "@/lib/useChatViewport";

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
  /**
   * "Forgot password?" is a bare text button outside both forms, so neither
   * form's isSubmitting covers it — without its own flag every extra tap
   * fired another reset email.
   */
  const [forgotLoading, setForgotLoading] = useState(false);

  const emailForm = useForm<EmailForm>({ defaultValues: { email: "" } });
  const passwordForm = useForm<PasswordForm>({ defaultValues: { password: "" } });

  // Reset to a clean state every time the modal opens.
  useEffect(() => {
    if (authModalOpen) {
      setStep("email");
      setEmail("");
      setServerMessage("");
      setFormError(null);
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
                  /* Never on touch: the native autoFocus fires on mount,
                     which throws the keyboard over the sheet while it is
                     still sliding in. The Modal already parks focus on the
                     panel for coarse pointers; the keyboard should appear
                     only when the user taps the field. */
                  autoFocus={step === "email" && !COARSE_POINTER}
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
                      <PasswordInput
                        id={id}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        autoFocus
                        {...passwordForm.register("password", {
                          required: "Password is required.",
                        })}
                      />
                    )}
                  </Field>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      /* Locked while the reset email is in flight: switching
                         steps mid-request would race its success handler,
                         which moves to "sent" for the email shown here. */
                      disabled={forgotLoading}
                      onClick={() => {
                        setStep("email");
                        passwordForm.reset({ password: "" });
                        setFormError(null);
                      }}
                      className="text-xs font-bold uppercase tracking-wide text-muted transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-50"
                    >
                      Change email
                    </button>
                    <button
                      type="button"
                      disabled={forgotLoading || busy}
                      aria-busy={forgotLoading || undefined}
                      onClick={async () => {
                        // The disabled attribute is the UI guard; this is the
                        // hard one, for the tap that lands before the
                        // re-render disables the button.
                        if (forgotLoading) return;
                        setForgotLoading(true);
                        try {
                          await authApi.forgotPassword(email);
                          setServerMessage(
                            "If the email is registered, a password reset link has been sent.",
                          );
                          setStep("sent");
                        } catch (error) {
                          setFormError(parseApiError(error).message);
                        } finally {
                          // Always released — the "sent" step keeps this
                          // component mounted, so a stuck flag would leave
                          // the button dead after "Use a different email".
                          setForgotLoading(false);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-50"
                    >
                      {/* The app's square spinner (see Spinner), sized to the
                          text link it sits in. */}
                      {forgotLoading && (
                        <span
                          aria-hidden
                          className="inline-block size-3 animate-spin border-2 border-current border-t-transparent"
                        />
                      )}
                      {forgotLoading ? "Sending link…" : "Forgot password?"}
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
