import { useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  BadgeCheck,
  ChevronRight,
  KeyRound,
  Lock,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { parseApiError } from "@/lib/errors";
import { PageTransition, staggerContainer, staggerItem } from "@/components/layout/PageTransition";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackButton";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { LogoutConfirmModal } from "./LogoutConfirmModal";

/**
 * One row per account action, in the Button press language.
 *
 * The page used to render the password form and a full logout section inline —
 * most of its height spent on things used a handful of times a year. Each is
 * now a single row that opens a dialog, and the whole page fits above the
 * fold.
 */
function ActionRow({
  icon: Icon,
  label,
  hint,
  danger = false,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-4 border-2 border-ink bg-surface p-4 text-left shadow-brutal",
        "transition-all duration-150 select-none",
        // The system's press signature, verbatim from Button: slide toward the
        // shadow on hover, land flat on press.
        "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-brutal-sm",
        "active:translate-x-[5px] active:translate-y-[5px] active:shadow-none",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center border-2 border-ink",
          danger ? "bg-danger text-white" : "bg-brand-yellow",
        )}
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block font-extrabold uppercase tracking-wide",
            danger ? "text-danger" : "text-ink",
          )}
        >
          {label}
        </span>
        <span className="block truncate text-xs text-muted">{hint}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden="true" />
    </button>
  );
}

export function ProfilePage() {
  const { user, logout, refreshUser } = useAuthStore();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

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

  // Unchanged from the inline version — the dialog only decides *whether* it
  // runs, never *what* it does.
  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate("/");
  };

  return (
    <PageTransition className="mx-auto max-w-2xl">
      <BackButton fallback="/home" label="Back" className="mb-6" />
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-5">
        {/* ------------------------------ identity ----------------------------- */}
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

          {/* A footnote, styled like one — this was a full bordered box, which
              gave a piece of trivia the same rank as the identity above it. */}
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
            <Lock className="size-3.5 shrink-0" aria-hidden="true" />
            Profile details are managed by the Ekaton team and can't be edited here.
          </p>
        </motion.section>

        {/* ------------------------------ actions ------------------------------ */}
        <motion.section variants={staggerItem} aria-label="Account actions" className="space-y-3">
          <ActionRow
            icon={KeyRound}
            label="Change password"
            hint="Your session stays signed in."
            onClick={() => setPasswordOpen(true)}
          />
          <ActionRow
            icon={LogOut}
            label="Log out"
            hint="Ends this session on this device."
            danger
            onClick={() => setLogoutOpen(true)}
          />
        </motion.section>
      </motion.div>

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      <LogoutConfirmModal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => void handleLogout()}
        loading={loggingOut}
      />
    </PageTransition>
  );
}
