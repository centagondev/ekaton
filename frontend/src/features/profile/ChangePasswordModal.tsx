import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { setTokens } from "@/lib/storage";
import { parseApiError } from "@/lib/errors";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import {
  PasswordRequirements,
  passwordMeetsAllRules,
  type ExtraRule,
} from "@/features/auth/PasswordRequirements";
import { cn } from "@/lib/utils";

/**
 * Change password, in a dialog instead of permanently on the page.
 *
 * The API call, the token rotation and the error mapping are lifted unchanged
 * from the inline form this replaces — what is new is the surface and the
 * feedback while typing.
 *
 * The requirements panel is the same shared component the Set/Reset Password
 * screens use, because the backend runs the same validator chain for all
 * three (services.change_password → validate_password). The inline form this
 * dialog replaced checked only length and not-all-numeric — everything else
 * surfaced as a server error after submit, which is exactly the surprise the
 * live panel exists to prevent. This flow adds one rule of its own: the new
 * password must differ from the current one.
 */

interface PasswordFormValues {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

/* ---------------------------------- form ----------------------------------- */

/**
 * Mounted fresh on every open (Modal only mounts children while open), so the
 * fields, the success state and the timer all reset by unmounting rather than
 * by bookkeeping.
 */
function ChangePasswordForm({ onClose }: { onClose: () => void }) {
  const [done, setDone] = useState(false);

  const form = useForm<PasswordFormValues>({
    // Validates as the user types — this is what turns the checklist, the
    // match line and the disabled button live. Pure sync work; nothing here
    // talks to the network before submit.
    mode: "onChange",
    defaultValues: { current_password: "", new_password: "", confirm_password: "" },
  });

  const values = form.watch();
  const confirmTouched = values.confirm_password.length > 0;
  const confirmMatches = confirmTouched && values.confirm_password === values.new_password;

  // The one rule specific to this flow, appended to the shared panel. The
  // closure reads the current password live, so clearing that field re-judges
  // this row immediately.
  const extraRules = useMemo<readonly ExtraRule[]>(
    () => [
      {
        key: "different",
        label: "Different from current",
        test: (password: string) =>
          password.length > 0 && password !== form.getValues("current_password"),
      },
    ],
    [form],
  );

  // Success closes the dialog on its own; cleared on unmount so a dismissed
  // dialog can't close its successor.
  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(onClose, 1500);
    return () => window.clearTimeout(timer);
  }, [done, onClose]);

  const submit = form.handleSubmit(async (formValues) => {
    try {
      const tokens = await authApi.changePassword(formValues);
      // The backend rotates tokens so the session survives the change.
      setTokens(tokens);
      setDone(true);
    } catch (error) {
      // Field errors land under their fields; the values stay put — a failed
      // attempt must never cost the user what they typed.
      const parsed = parseApiError(error);
      let handled = false;
      for (const [key, message] of Object.entries(parsed.fields)) {
        if (key in formValues) {
          form.setError(key as keyof PasswordFormValues, { type: "server", message });
          handled = true;
        }
      }
      if (!handled) toast.error(parsed.message);
    }
  });

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-10" role="status">
        <motion.span
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="flex size-14 items-center justify-center border-2 border-ink bg-brand-lime shadow-brutal"
        >
          <Check className="size-7" strokeWidth={3} />
        </motion.span>
        <p className="font-mono text-sm font-black uppercase tracking-[0.18em]">
          Password updated
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field
        label="Current password"
        required
        error={form.formState.errors.current_password?.message ?? null}
      >
        {(id) => (
          <PasswordInput
            id={id}
            autoComplete="current-password"
            {...form.register("current_password", { required: "Current password is required." })}
          />
        )}
      </Field>

      <Field
        label="New password"
        required
        // Rule failures speak through the checklist below, not through error
        // text saying the same thing twice. Only the server gets this line.
        error={
          form.formState.errors.new_password?.type === "server"
            ? (form.formState.errors.new_password.message ?? null)
            : null
        }
      >
        {(id) => (
          <>
            <PasswordInput
              id={id}
              autoComplete="new-password"
              {...form.register("new_password", {
                // Mirrors the panel: every backend rule plus differs-from-
                // current. This is what holds the submit button until the
                // password would actually be accepted.
                validate: {
                  rules: (value) => passwordMeetsAllRules(value),
                  differs: (value) => value !== form.getValues("current_password"),
                },
              })}
            />
            <PasswordRequirements
              password={values.new_password}
              visible
              extraRules={extraRules}
            />
          </>
        )}
      </Field>

      <Field
        label="Confirm new password"
        required
        error={
          form.formState.errors.confirm_password?.type === "server"
            ? (form.formState.errors.confirm_password.message ?? null)
            : null
        }
      >
        {(id) => (
          <PasswordInput
            id={id}
            autoComplete="new-password"
            {...form.register("confirm_password", {
              required: true,
              validate: (value) => value === form.getValues("new_password"),
            })}
          />
        )}
      </Field>

      {/* Always-rendered line, so verdicts appear without shifting layout. */}
      <p
        className={cn(
          "flex min-h-4 items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em]",
          confirmMatches ? "text-ink" : "text-danger",
        )}
        aria-live="polite"
      >
        {confirmTouched &&
          (confirmMatches ? (
            <>
              <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> Passwords match
            </>
          ) : (
            <>
              <X className="size-3.5" strokeWidth={3} aria-hidden="true" /> Passwords don't match
            </>
          ))}
      </p>

      {/* Full-width and stacked on a phone, matching the logout sheet: two
          short buttons crowded into the bottom-right corner of a full-width
          sheet are the hardest targets on the page. DOM order keeps Cancel
          first — `flex-col-reverse` is what lifts the primary action above it
          on small screens without changing the tab order. */}
      <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          loading={form.formState.isSubmitting}
          disabled={!form.formState.isValid}
          className="w-full sm:w-auto"
        >
          {form.formState.isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </div>
    </form>
  );
}

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Change password" size="md">
      <ChangePasswordForm onClose={onClose} />
    </Modal>
  );
}
