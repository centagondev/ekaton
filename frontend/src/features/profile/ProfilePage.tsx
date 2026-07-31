import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BadgeCheck, KeyRound, LogOut, RefreshCw } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { authApi } from "@/lib/api/auth";
import { setTokens } from "@/lib/storage";
import { parseApiError } from "@/lib/errors";
import { PageTransition, staggerContainer, staggerItem } from "@/components/layout/PageTransition";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackButton";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Field } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";

export function ProfilePage() {
  const { user, logout, refreshUser } = useAuthStore();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const reload = async () => {
    setRefreshing(true);
    try {
      await refreshUser();
      toast.success("Profile refreshed.");
    } catch (error) {
      toast.error(parseApiError(error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate("/");
  };

  return (
    <PageTransition className="mx-auto max-w-2xl">
      <BackButton fallback="/home" label="Back" className="mb-6" />
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-8">
        <motion.section
          variants={staggerItem}
          className="border-2 border-ink bg-surface p-6 shadow-brutal sm:p-8"
          aria-label="Your profile"
        >
          <div className="flex flex-wrap items-center gap-5">
            <Avatar name={user?.full_name} src={user?.profile_photo} className="size-20 text-2xl" />
            <div className="min-w-0 flex-1">
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-black uppercase tracking-tight">
                <span className="truncate">{user?.full_name}</span>
                {user?.is_verified && (
                  <BadgeCheck className="size-5 shrink-0" aria-label="Verified account" />
                )}
              </h1>
              <p className="truncate text-sm text-muted">{user?.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {user?.batch && <Badge tone="yellow">Batch {user.batch}</Badge>}
                {user?.gender && <Badge tone="neutral">{user.gender}</Badge>}
                <Badge tone={user?.is_available ? "lime" : "neutral"}>
                  {user?.is_available ? "Available to chat" : "Unavailable"}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void reload()}
              loading={refreshing}
              aria-label="Refresh profile"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>

          <p className="mt-4 border-2 border-ink bg-raised px-4 py-2.5 text-xs text-muted">
            Profile details and availability are managed by the Ekaton team — the
            backend exposes no endpoint to edit them.
          </p>
        </motion.section>

        <motion.section variants={staggerItem} aria-labelledby="change-password">
          <h2
            id="change-password"
            className="mb-4 flex items-center gap-2 text-lg font-black uppercase tracking-wide"
          >
            <KeyRound className="size-5" /> Change password
          </h2>
          <ChangePasswordForm />
        </motion.section>

        <motion.section
          variants={staggerItem}
          className="flex items-center justify-between gap-4 border-2 border-ink bg-surface p-5"
        >
          <div>
            <p className="font-bold uppercase tracking-wide">Log out</p>
            <p className="text-xs text-muted">Ends this session on this device.</p>
          </div>
          <Button variant="danger" onClick={() => void handleLogout()} loading={loggingOut}>
            <LogOut className="size-4" /> Log out
          </Button>
        </motion.section>
      </motion.div>
    </PageTransition>
  );
}

interface PasswordFormValues {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

function ChangePasswordForm() {
  const form = useForm<PasswordFormValues>({
    defaultValues: { current_password: "", new_password: "", confirm_password: "" },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      const tokens = await authApi.changePassword(values);
      // The backend rotates tokens so the session survives the change.
      setTokens(tokens);
      form.reset({ current_password: "", new_password: "", confirm_password: "" });
      toast.success("Password changed.");
    } catch (error) {
      const parsed = parseApiError(error);
      let handled = false;
      for (const [key, message] of Object.entries(parsed.fields)) {
        if (key in values) {
          form.setError(key as keyof PasswordFormValues, { message });
          handled = true;
        }
      }
      if (!handled) toast.error(parsed.message);
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4 border-2 border-ink bg-surface p-5" noValidate>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="New password"
          required
          error={form.formState.errors.new_password?.message ?? null}
        >
          {(id) => (
            <PasswordInput
              id={id}
              autoComplete="new-password"
              {...form.register("new_password", {
                required: "New password is required.",
                minLength: { value: 8, message: "Must be at least 8 characters." },
                validate: (value) =>
                  !/^\d+$/.test(value) || "Password cannot be entirely numeric.",
              })}
            />
          )}
        </Field>

        <Field
          label="Confirm new password"
          required
          error={form.formState.errors.confirm_password?.message ?? null}
        >
          {(id) => (
            <PasswordInput
              id={id}
              autoComplete="new-password"
              {...form.register("confirm_password", {
                required: "Please confirm your password.",
                validate: (value) =>
                  value === form.getValues("new_password") || "Passwords do not match.",
              })}
            />
          )}
        </Field>
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={form.formState.isSubmitting}>
          Update password
        </Button>
      </div>
    </form>
  );
}
