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
import { cn } from "@/lib/utils";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { LogoutConfirmModal } from "./LogoutConfirmModal";
import { ProfilePhotoUploader } from "./ProfilePhotoUploader";

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
            "block font-extrabold uppercase leading-tight tracking-wide",
            danger ? "text-danger" : "text-ink",
          )}
        >
          {label}
        </span>
        {/* Wraps rather than truncates: side by side on a tablet these columns
            are half as wide as they were, and a clipped hint reads as a bug. */}
        <span className="mt-0.5 block text-xs leading-snug text-muted">{hint}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden="true" />
    </button>
  );
}

export function ProfilePage() {
  // Selected field by field, not `useAuthStore()` wholesale: the object form
  // subscribes this page to every slice of the store, so an unrelated write re-
  // rendered the page — and with it both mounted dialogs — for nothing.
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const refreshUser = useAuthStore((state) => state.refreshUser);
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
    <PageTransition className="mx-auto w-full max-w-3xl">
      <BackButton fallback="/home" label="Back" className="mb-5 sm:mb-6" />
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="space-y-5 sm:space-y-6"
      >
        {/* ------------------------------ identity ----------------------------- */}
        <motion.section
          variants={staggerItem}
          className="relative border-2 border-ink bg-surface p-5 shadow-brutal sm:p-7 lg:p-8"
          aria-label="Your profile"
        >
          {/* Pinned rather than placed at the end of the identity row: as a
              flex sibling it was the item that wrapped on a narrow phone,
              landing on a line of its own under the name. */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void reload()}
            loading={refreshing}
            aria-label="Refresh profile"
            className="absolute right-3 top-3 sm:right-4 sm:top-4"
          >
            <RefreshCw className="size-4" />
          </Button>

          {/* Stacked on a phone so the name gets the full column width, side by
              side from `sm` up where there is room for both. */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <ProfilePhotoUploader />
            {/* `pr-12` on the row layout keeps the longest name clear of the
                refresh button above it. */}
            <div className="min-w-0 flex-1 sm:pr-12">
              <h1 className="flex items-start gap-2 text-xl font-black uppercase leading-[1.15] tracking-tight sm:text-2xl lg:text-[1.75rem]">
                {/* Wraps instead of truncating — a profile that cannot show
                    its owner's name in full has failed at its one job.
                    `break-words` is the guard for a single unbroken word. */}
                <span className="min-w-0 break-words">{user?.full_name}</span>
                {user?.is_verified && (
                  <BadgeCheck
                    className="mt-1 size-5 shrink-0 sm:mt-1.5"
                    aria-label="Verified account"
                  />
                )}
              </h1>
              {/* Long addresses wrap at any character rather than overflowing
                  the card; `title` gives the pointer user the whole string in
                  one line, and it stays selectable for copying. */}
              <p
                className="mt-1.5 text-sm leading-snug text-muted [overflow-wrap:anywhere]"
                title={user?.email}
              >
                {user?.email}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {user?.batch && <Badge tone="yellow">Batch {user.batch}</Badge>}
                {user?.gender && <Badge tone="neutral">{user.gender}</Badge>}
                {/* Availability is only worth a badge when it is true. The
                    `false` branch used to render "Unavailable", which named a
                    state the user cannot see the cause of or change from here,
                    so it read as an error rather than as information. */}
                {user?.is_available && <Badge tone="lime">Available to chat</Badge>}
              </div>
            </div>
          </div>

          {/* A footnote, styled like one — this was a full bordered box, which
              gave a piece of trivia the same rank as the identity above it.
              The photo is now the one editable field, so the copy names it
              rather than claiming the whole profile is locked. */}
          <p className="mt-5 flex items-start gap-1.5 border-t border-ink/10 pt-4 text-xs leading-relaxed text-muted">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Tap your photo to view it, or the camera icon to change it. Other details are
              managed by the Ekaton team.
            </span>
          </p>
        </motion.section>

        {/* ------------------------------ actions ------------------------------ */}
        <motion.section variants={staggerItem} aria-labelledby="account-actions">
          <h2
            id="account-actions"
            className="mb-3 font-mono text-[11px] font-black uppercase tracking-[0.18em] text-muted"
          >
            Account
          </h2>
          {/* Two columns from `sm` up: stacked full-width rows left a desktop
              page that was mostly empty below the fold. */}
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
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
