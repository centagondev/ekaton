import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Shield, Upload, User } from "lucide-react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { useProfileStore } from "../store/profile.store";

// ── Validation schemas ────────────────────────────────────────────────────────

const profileSchema = yup.object({
  full_name: yup.string().trim().required("Full name is required"),
  batch: yup.string().trim().required("Batch is required"),
});

const passwordSchema = yup.object({
  current_password: yup.string().required("Current password is required"),
  new_password: yup
    .string()
    .min(12, "Min. 12 characters")
    .required("New password is required"),
  confirm_password: yup
    .string()
    .oneOf([yup.ref("new_password")], "Passwords do not match")
    .required("Please confirm your password"),
});

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ color = "bg-[#FFDE00]", children }) {
  return (
    <div
      className={`${color} border-2 border-black px-5 py-3`}
    >
      <span className="text-xs font-bold uppercase tracking-widest text-black">
        {children}
      </span>
    </div>
  );
}

function FormInput({ label, id, error, className = "", ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={id}
          className="text-[10px] font-bold uppercase tracking-widest text-gray-500"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={`border-2 border-black bg-white px-4 py-3 font-medium text-black focus:outline-none focus:ring-0 ${className}`}
        {...props}
      />
      {error && (
        <p className="text-xs font-bold text-red-500">{error}</p>
      )}
    </div>
  );
}

function PasswordInput({ label, id, error, register, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={id}
          className="text-[10px] font-bold uppercase tracking-widest text-gray-500"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          className="w-full border-2 border-black bg-white px-4 py-3 font-medium text-black focus:outline-none focus:ring-0"
          {...register}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
          tabIndex={-1}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error && (
        <p className="text-xs font-bold text-red-500">{error}</p>
      )}
    </div>
  );
}

// ── Change Password Modal ─────────────────────────────────────────────────────

function ChangePasswordModal({ onClose }) {
  const { changingPassword, changePassword } = useProfileStore();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: yupResolver(passwordSchema) });

  const onSubmit = async (data) => {
    try {
      await changePassword({
        current_password: data.current_password,
        new_password: data.new_password,
        confirm_password: data.confirm_password,
      });
      toast.success("Password updated successfully!");
      reset();
      onClose();
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.current_password?.[0] ||
        "Failed to change password.";
      toast.error(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md border-2 border-black bg-white shadow-[6px_6px_0px_black]">
        {/* Modal header */}
        <div className="flex items-center justify-between border-b-2 border-black bg-[#FFDE00] px-5 py-4">
          <div className="flex items-center gap-2">
            <Shield className="size-4" />
            <span className="text-sm font-bold uppercase tracking-widest">
              Security
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center border-2 border-black bg-white font-extrabold text-black shadow-[2px_2px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_black] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 flex flex-col gap-5">
          <div>
            <h2 className="text-lg font-extrabold uppercase tracking-tight">
              Change Password
            </h2>
            <p className="mt-1 text-sm font-medium text-gray-500">
              Update your account credentials to maintain high-level security protocols.
            </p>
          </div>

          <PasswordInput
            id="current_password"
            label="Current Password"
            register={register("current_password")}
            error={errors.current_password?.message}
            placeholder="••••••••••••"
          />

          <div className="flex flex-col gap-1">
            <PasswordInput
              id="new_password"
              label="New Password"
              register={register("new_password")}
              error={errors.new_password?.message}
              placeholder="Min. 12 characters"
            />
          </div>

          <PasswordInput
            id="confirm_password"
            label="Confirm New Password"
            register={register("confirm_password")}
            error={errors.confirm_password?.message}
            placeholder="Re-enter password"
          />

          <button
            type="submit"
            disabled={changingPassword}
            className="mt-1 border-2 border-black bg-[#FFDE00] px-8 py-4 font-extrabold uppercase tracking-wider text-black shadow-[5px_5px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0px_black] active:translate-x-[5px] active:translate-y-[5px] active:shadow-none transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {changingPassword ? "Updating…" : "Update Password"}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="border-2 border-black bg-white px-8 py-4 font-extrabold uppercase tracking-wider text-black hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>

          {/* Security tip */}
          <div className="border-t-2 border-dashed border-gray-300 pt-4">
            <div className="flex gap-3 rounded-none border-2 border-black bg-[#E8EBFF] p-3">
              <Lock className="mt-0.5 size-4 shrink-0 text-gray-600" />
              <p className="text-xs font-medium text-gray-700">
                Use a strong password to keep your account secure. We recommend a mix of uppercase, numbers, and symbols.
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main ProfilePage ──────────────────────────────────────────────────────────

const ProfilePage = () => {
  const user = useAuthStore((state) => state.user);
  const { loading, updating, fetchMe, updateMe } = useProfileStore();
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name || "",
      batch: user?.batch || "",
    },
  });

  // Fetch fresh profile data on mount
  useEffect(() => {
    fetchMe().catch(() => {});
  }, [fetchMe]);

  // Keep form in sync when user data arrives
  useEffect(() => {
    if (user) {
      reset({ full_name: user.full_name, batch: user.batch });
    }
  }, [user, reset]);

  const onSave = async (data) => {
    try {
      await updateMe({ full_name: data.full_name, batch: data.batch });
      toast.success("Profile updated!");
      setIsEditing(false);
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to update profile."
      );
    }
  };

  const handleCancel = () => {
    reset({ full_name: user?.full_name || "", batch: user?.batch || "" });
    setIsEditing(false);
  };

  // Derive initials for avatar fallback
  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  // Format member since date
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <div className="min-h-dvh bg-[#FBF9F5] px-4 py-10 md:px-6">
      <div className="mx-auto max-w-7xl">
        {/* Page heading */}
        <div className="mb-10 border-l-4 border-black pl-4">
          <h1 className="text-3xl font-black uppercase tracking-tight md:text-4xl">
            My Profile
          </h1>
          <p className="mt-1 text-sm font-medium text-gray-500">
            Manage your account, personal information, and security settings within the university ecosystem.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
          {/* ── Left sidebar — Avatar + quick info ── */}
          <div className="border-2 border-black bg-[#E8EBFF] p-5 shadow-[5px_5px_0px_black]">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                {user?.profile_photo ? (
                  <img
                    src={user.profile_photo}
                    alt={user.full_name}
                    className="h-[130px] w-[130px] border-2 border-black object-cover"
                  />
                ) : (
                  <div className="flex h-[130px] w-[130px] items-center justify-center border-2 border-black bg-[#FFDE00]">
                    <span className="text-3xl font-black text-black">
                      {initials}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="flex items-center gap-1.5 border-2 border-black bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-black shadow-[2px_2px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_black] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150"
              >
                <Upload className="size-3" />
                Upload Photo
              </button>
            </div>

            {/* Quick info */}
            <div className="mt-6 flex flex-col gap-3 border-t-2 border-black pt-4">
              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="h-4 animate-pulse bg-black/10"
                    />
                  ))}
                </div>
              ) : (
                <>
                  <InfoRow label="Full Name" value={user?.full_name} />
                  <InfoRow label="Email" value={user?.email} />
                  <InfoRow label="Batch" value={user?.batch} />
                  <InfoRow
                    label="Status"
                    value={
                      user?.is_available ? (
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                          Available
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full bg-gray-400" />
                          Unavailable
                        </span>
                      )
                    }
                  />
                  <InfoRow label="Member Since" value={memberSince} />
                </>
              )}
            </div>
          </div>

          {/* ── Right panel ── */}
          <div className="flex flex-col gap-6">
            {/* Personal Information */}
            <div className="border-2 border-black bg-white shadow-[5px_5px_0px_black]">
              <SectionHeader>Personal Information</SectionHeader>

              <form onSubmit={handleSubmit(onSave)} className="p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormInput
                    id="full_name"
                    label="Full Name"
                    placeholder="Your full name"
                    disabled={!isEditing}
                    {...register("full_name")}
                    className={!isEditing ? "bg-[#FBF9F5] cursor-not-allowed" : ""}
                    error={errors.full_name?.message}
                  />

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="email"
                      className="text-[10px] font-bold uppercase tracking-widest text-gray-500"
                    >
                      Email (Read Only)
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={user?.email || ""}
                      readOnly
                      disabled
                      className="border-2 border-black bg-[#FBF9F5] px-4 py-3 font-medium text-gray-500 cursor-not-allowed focus:outline-none"
                    />
                  </div>

                  <FormInput
                    id="batch"
                    label="Batch"
                    placeholder="e.g. BootCamp 2025"
                    disabled={!isEditing}
                    {...register("batch")}
                    className={!isEditing ? "bg-[#FBF9F5] cursor-not-allowed" : ""}
                    error={errors.batch?.message}
                  />

                  {/* Availability toggle — only shown in edit mode */}
                  {isEditing && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        Availability
                      </label>
                      <div className="flex items-center gap-3 border-2 border-black bg-white px-4 py-3">
                        <label className="relative inline-flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            {...register("is_available")}
                            defaultChecked={user?.is_available}
                          />
                          <div className="peer h-5 w-9 rounded-full border-2 border-black bg-gray-200 peer-checked:bg-[#CCFF00] transition-colors" />
                          <div className="absolute left-1 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-black bg-white transition-all peer-checked:left-5" />
                        </label>
                        <span className="text-sm font-medium">
                          {user?.is_available ? "Available for chat" : "Not available"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="border-2 border-black bg-[#FFDE00] px-6 py-3 font-extrabold uppercase tracking-wider text-black shadow-[4px_4px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_black] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all duration-150"
                    >
                      Edit Profile
                    </button>
                  ) : (
                    <>
                      <button
                        type="submit"
                        disabled={updating}
                        className="border-2 border-black bg-[#FFDE00] px-6 py-3 font-extrabold uppercase tracking-wider text-black shadow-[4px_4px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_black] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {updating ? "Saving…" : "Save Changes"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="border-2 border-black bg-white px-6 py-3 font-extrabold uppercase tracking-wider text-black hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </form>
            </div>

            {/* Password & Security */}
            <div className="border-2 border-black bg-white shadow-[5px_5px_0px_black]">
              <SectionHeader color="bg-[#CCFF00]">Password &amp; Security</SectionHeader>

              <div className="p-6">
                <p className="mb-4 text-sm font-medium text-gray-500">
                  Keep your account secure by using a strong, unique password.
                </p>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(true)}
                  className="border-2 border-black bg-[#FFDE00] px-6 py-3 font-extrabold uppercase tracking-wider text-black shadow-[4px_4px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_black] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all duration-150"
                >
                  Change Password
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </div>
  );
};

// ── Helper ────────────────────────────────────────────────────────────────────

function InfoRow({ label, value }) {
  return (
    <div className="border-b border-black/10 pb-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
        {label}
      </p>
      <div className="mt-0.5 text-sm font-bold text-black">{value || "—"}</div>
    </div>
  );
}

export default ProfilePage;
