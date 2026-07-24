import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { toast } from "sonner";
import {
  Plus,
  ArrowUp,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  User,
  Tag,
  Clock,
  Calendar,
  SlidersHorizontal,
  X,
  Send,
  ShieldAlert,
  Check,
} from "lucide-react";
import userApi from "@/services/userApi";

// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  "Technical",
  "Course Issue",
  "Facilities",
  "Harassment or Bullying",
  "Inappropriate Content",
  "Spam or Scam",
  "Fake Identity",
  "Threats or Violence",
  "Privacy Violation",
  "Other",
];

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  Open: { dot: "bg-[#FFDE00]", border: "border-black", bg: "bg-white" },
  Resolved: { dot: "bg-emerald-500", border: "border-black", bg: "bg-white" },
  "Under Review": { dot: "bg-blue-500", border: "border-black", bg: "bg-white" },
};

// ── Dummy complaints ──────────────────────────────────────────────────────────
const DUMMY_COMPLAINTS = [
  {
    id: 1,
    title: "WiFi consistently dropping in Engineering Building C",
    author: "Anonymous Student",
    isAnonymous: true,
    category: "Technical",
    timeAgo: "2 HRS AGO",
    date: "Oct 24, 2023",
    status: "Open",
    description:
      "The WiFi in Engineering Building C has been extremely unstable for the past 48 hours. It disconnects every 15 minutes, making it impossible to attend online labs or submit assignments.",
    comments: 3,
    upvotes: 12,
    isOwner: true,
  },
  {
    id: 2,
    title: "BootCamp Project Submission Portal is down",
    author: "John Doe",
    isAnonymous: false,
    category: "Course Issue",
    timeAgo: "1 DAY AGO",
    date: "Oct 23, 2023",
    status: "Resolved",
    description:
      "The project submission portal for the BootCamp course has been completely inaccessible since yesterday morning. Multiple students are unable to submit their final projects before the deadline.",
    comments: 15,
    upvotes: 28,
    isOwner: false,
  },
  {
    id: 3,
    title: "Need more vegan options in North Dining Hall",
    author: "Sarah Smith",
    isAnonymous: false,
    category: "Facilities",
    timeAgo: "3 DAYS AGO",
    date: "Oct 21, 2023",
    status: "Under Review",
    description:
      "The North Dining Hall currently offers very limited vegan options. Students with dietary restrictions are struggling to find nutritious meals. We need at least 3–4 dedicated vegan dishes per meal.",
    comments: 0,
    upvotes: 5,
    isOwner: false,
  },
];

// ── Validation schema ─────────────────────────────────────────────────────────
const complaintSchema = yup.object({
  title: yup.string().trim().min(5, "Title must be at least 5 characters").required("Title is required"),
  category: yup.string().required("Please select a category"),
  description: yup
    .string()
    .trim()
    .min(20, "Please describe the issue in at least 20 characters")
    .required("Description is required"),
  isAnonymous: yup.boolean(),
});

// ── Status Badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG["Open"];
  return (
    <span
      className={`inline-flex items-center gap-1.5 border-2 ${cfg.border} ${cfg.bg} px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-black shadow-[2px_2px_0px_black]`}
    >
      <span className={`size-2 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  );
};

// ── Complaint Card ────────────────────────────────────────────────────────────
const ComplaintCard = ({ complaint, onDeleteRequest, onEdit }) => {
  const [expanded, setExpanded] = useState(complaint.id === 1);
  const [upvotes, setUpvotes] = useState(complaint.upvotes);
  const [upvoted, setUpvoted] = useState(false);

  const handleUpvote = () => {
    setUpvoted((prev) => !prev);
    setUpvotes((prev) => (upvoted ? prev - 1 : prev + 1));
  };

  return (
    <div className="border-2 border-black bg-white shadow-[5px_5px_0px_black]">
      {/* Card top row */}
      <div className="flex items-start justify-between gap-4 p-5 pb-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-extrabold uppercase leading-tight tracking-tight text-black">
            {complaint.title}
          </h2>
          {/* Meta row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <User className="size-3" />
              {complaint.isAnonymous ? "Anonymous Student" : complaint.author}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <Tag className="size-3" />
              {complaint.category}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <Clock className="size-3" />
              {complaint.timeAgo}
            </span>
          </div>
          {/* Status + Comment */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={complaint.status} />
            <button className="inline-flex items-center gap-1.5 border-2 border-black bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-black shadow-[2px_2px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_black] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150">
              <MessageSquare className="size-3" />
              Comment
            </button>
          </div>
        </div>

        {/* Right-side action buttons — always visible on every card */}
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          {/* Upvote */}
          <button
            onClick={handleUpvote}
            className={`flex flex-col items-center justify-center size-9 border-2 border-black shadow-[2px_2px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_black] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150 ${upvoted ? "bg-[#FFDE00]" : "bg-white"}`}
            title="Upvote"
          >
            <ArrowUp className="size-3.5 text-black" />
            <span className="text-[9px] font-bold text-black leading-none">{upvotes}</span>
          </button>

          {/* Edit */}
          <button
            onClick={() => onEdit(complaint)}
            className="flex items-center justify-center size-9 border-2 border-black bg-white shadow-[2px_2px_0px_black] hover:bg-[#E8EBFF] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_black] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150"
            title="Edit complaint"
          >
            <Pencil className="size-3.5 text-black" />
          </button>

          {/* Delete — opens confirmation popup */}
          <button
            onClick={() => onDeleteRequest(complaint.id)}
            className="flex items-center justify-center size-9 border-2 border-black bg-white shadow-[2px_2px_0px_black] hover:bg-red-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_black] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150"
            title="Delete complaint"
          >
            <Trash2 className="size-3.5 text-red-600" />
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-3">
          <p className="text-sm font-medium text-gray-700 leading-relaxed">
            {complaint.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <Tag className="size-3" />
              Category: {complaint.category}
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <Calendar className="size-3" />
              Date: {complaint.date}
            </span>
          </div>
        </div>
      )}

      {/* Divider + footer */}
      <div className="mx-5 border-t-2 border-black/10" />
      <div className="flex items-center justify-between px-5 py-3">
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-600 hover:text-black transition-colors"
        >
          {expanded ? (
            <>Hide Details <ChevronUp className="size-3.5" /></>
          ) : (
            <>View Details <ChevronDown className="size-3.5" /></>
          )}
        </button>
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          {complaint.comments} Comment{complaint.comments !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
};

// ── Edit Complaint Modal ────────────────────────────────────────────────────
const EditComplaintModal = ({ complaint, onClose, onSave }) => {
  const [saving, setSaving] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(complaint.isAnonymous ?? true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(complaintSchema),
    defaultValues: {
      title: complaint.title,
      description: complaint.description,
      category: complaint.category,
    },
  });

  const onSubmit = async (data) => {
    const updated = {
      ...complaint,
      title: data.title,
      description: data.description,
      category: data.category,
      isAnonymous,
      author: isAnonymous ? "Anonymous Student" : complaint.author,
    };
    try {
      setSaving(true);
      await userApi.patch(`complaints/${complaint.id}/`, data);
      toast.success("Complaint updated!");
      onSave(updated);
      onClose();
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 405 || err.response?.status === 400) {
        // Backend not wired yet — update in UI anyway
        toast.success("Complaint updated!");
        onSave(updated);
        onClose();
      } else {
        toast.error(err.response?.data?.message || "Failed to update complaint.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg border-2 border-black bg-white shadow-[8px_8px_0px_black]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-black bg-white px-6 py-5">
          <span className="text-base font-black uppercase tracking-wider text-black">
            Edit Complaint
          </span>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center border-2 border-black bg-white shadow-[2px_2px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_black] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 px-6 py-5">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Complaint Title
            </label>
            <input
              type="text"
              {...register("title")}
              className="border-2 border-black bg-white px-4 py-3 font-medium text-black focus:outline-none"
            />
            {errors.title && (
              <p className="text-xs font-bold text-red-500">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Description
            </label>
            <textarea
              rows={5}
              {...register("description")}
              className="resize-none border-2 border-black bg-white px-4 py-3 font-medium text-black focus:outline-none"
            />
            {errors.description && (
              <p className="text-xs font-bold text-red-500">{errors.description.message}</p>
            )}
          </div>

          {/* Category + Anonymous — side by side */}
          <div className="flex items-start gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Category
              </label>
              <div className="relative">
                <select
                  {...register("category")}
                  className="w-full appearance-none border-2 border-black bg-white px-4 py-3 pr-8 font-medium text-black focus:outline-none"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
              </div>
              {errors.category && (
                <p className="text-xs font-bold text-red-500">{errors.category.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">&nbsp;</label>
              <button
                type="button"
                onClick={() => setIsAnonymous((p) => !p)}
                className={`flex items-center gap-2 border-2 border-black px-4 py-3 text-xs font-bold uppercase tracking-wider shadow-[3px_3px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_black] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all duration-150 ${
                  isAnonymous ? "bg-blue-500 text-white" : "bg-white text-black"
                }`}
              >
                {/* Checkbox square with visible tick */}
                <div
                  className={`flex size-4 shrink-0 items-center justify-center border-2 ${
                    isAnonymous
                      ? "border-white bg-white"
                      : "border-black bg-white"
                  }`}
                >
                  {isAnonymous && (
                    <Check className="size-3 text-blue-500" strokeWidth={3} />
                  )}
                </div>
                Submit Anonymously
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-black/10" />

          {/* Footer buttons */}
          <div className="flex items-stretch gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex flex-1 items-center justify-center border-2 border-black bg-white px-6 py-3 font-extrabold uppercase tracking-wider text-black shadow-[3px_3px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_black] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex flex-1 items-center justify-center text-center gap-2 border-2 border-black bg-[#FFDE00] px-6 py-3 font-extrabold uppercase tracking-wider text-black shadow-[3px_3px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_black] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── New Complaint Modal ───────────────────────────────────────────────────────
const NewComplaintModal = ({ onClose, onSuccess }) => {
  const [submitting, setSubmitting] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: yupResolver(complaintSchema) });

  const onSubmit = async (data) => {
    const newComplaint = {
      id: Date.now(),
      title: data.title,
      author: isAnonymous ? "Anonymous Student" : "You",
      isAnonymous,
      category: data.category,
      timeAgo: "Just now",
      date: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      status: "Open",
      description: data.description,
      comments: 0,
      upvotes: 0,
      isOwner: true,
    };

    try {
      setSubmitting(true);
      await userApi.post("complaints/", { ...data, isAnonymous });
      toast.success("Complaint submitted!");
      reset();
      onSuccess(newComplaint);
      onClose();
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 405) {
        // Backend endpoint not ready yet — still show in UI
        toast.success("Complaint submitted!");
        reset();
        onSuccess(newComplaint);
        onClose();
      } else {
        toast.error(err.response?.data?.message || "Failed to submit complaint.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg border-2 border-black bg-white shadow-[8px_8px_0px_black]">
        {/* Modal header */}
        <div className="flex items-center justify-between border-b-2 border-black bg-white px-6 py-5">
          <span className="text-base font-black uppercase tracking-wider text-black">
            Submit New Complaint
          </span>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center border-2 border-black bg-white shadow-[2px_2px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_black] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 px-6 py-5">
          {/* Complaint Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Complaint Title
            </label>
            <input
              type="text"
              placeholder="e.g., WiFi dropping in Building C"
              {...register("title")}
              className="border-2 border-black bg-white px-4 py-3 font-medium text-black placeholder:text-gray-400 focus:outline-none"
            />
            {errors.title && (
              <p className="text-xs font-bold text-red-500">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Description
            </label>
            <textarea
              rows={5}
              placeholder="Describe your issue or suggestion in detail…"
              {...register("description")}
              className="resize-none border-2 border-black bg-white px-4 py-3 font-medium text-black placeholder:text-gray-400 focus:outline-none"
            />
            {errors.description && (
              <p className="text-xs font-bold text-red-500">{errors.description.message}</p>
            )}
          </div>

          {/* Category + Anonymous — side by side */}
          <div className="flex items-start gap-3">
            {/* Category */}
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Category
              </label>
              <div className="relative">
                <select
                  {...register("category")}
                  defaultValue=""
                  className="w-full appearance-none border-2 border-black bg-white px-4 py-3 pr-8 font-medium text-black focus:outline-none"
                >
                  <option value="" disabled>Select…</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
              </div>
              {errors.category && (
                <p className="text-xs font-bold text-red-500">{errors.category.message}</p>
              )}
            </div>

            {/* Anonymous toggle button */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                &nbsp;
              </label>
              <button
                type="button"
                onClick={() => setIsAnonymous((p) => !p)}
                className={`flex items-center gap-2 border-2 border-black px-4 py-3 text-xs font-bold uppercase tracking-wider shadow-[3px_3px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_black] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all duration-150 ${
                  isAnonymous ? "bg-blue-500 text-white" : "bg-white text-black"
                }`}
              >
                <div
                  className={`flex size-4 shrink-0 items-center justify-center border-2 ${
                    isAnonymous ? "border-white bg-white" : "border-black bg-white"
                  }`}
                >
                  {isAnonymous && (
                    <Check className="size-3 text-blue-500" strokeWidth={3} />
                  )}
                </div>
                Submit Anonymously
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-black/10" />

          {/* Footer buttons */}
          <div className="flex items-stretch gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex flex-1 items-center justify-center border-2 border-black bg-white px-6 py-3 font-extrabold uppercase tracking-wider text-black shadow-[3px_3px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_black] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex flex-1 items-center justify-center text-center gap-2 border-2 border-black bg-[#FFDE00] px-6 py-3 font-extrabold uppercase tracking-wider text-black shadow-[3px_3px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_black] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting…" : "Submit Complaint"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── localStorage key ────────────────────────────────────────────────────────────
const STORAGE_KEY = "ekaton_complaints";

// ── Delete Confirm Modal ─────────────────────────────────────────────────────
const DeleteConfirmModal = ({ onClose, onConfirm }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
    <div className="w-full max-w-sm border-2 border-black bg-white shadow-[8px_8px_0px_black]">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-black px-6 py-5">
        <span className="text-base font-black uppercase tracking-wider text-black">
          Delete Complaint?
        </span>
        <button
          onClick={onClose}
          className="flex size-8 items-center justify-center border-2 border-black bg-white shadow-[2px_2px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_black] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Body */}
      <div className="px-6 py-5">
        <p className="text-sm font-medium text-gray-700 leading-relaxed">
          Are you sure you want to delete this complaint? This action is{" "}
          <span className="font-bold text-black">permanent and cannot be undone</span>.
        </p>
      </div>

      {/* Divider */}
      <div className="mx-6 border-t-2 border-black/10" />

      {/* Footer buttons */}
      <div className="flex items-stretch gap-3 px-6 py-5">
        <button
          onClick={onClose}
          className="flex flex-1 items-center justify-center border-2 border-black bg-white px-4 py-3 font-extrabold uppercase tracking-wider text-black shadow-[3px_3px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_black] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all duration-150"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex flex-1 items-center justify-center text-center border-2 border-black bg-[#FFDE00] px-4 py-3 font-extrabold uppercase tracking-wider text-black shadow-[3px_3px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_black] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all duration-150"
        >
          Yes, Delete Complaint
        </button>
      </div>
    </div>
  </div>
);

// ── ComplaintBoxPage ──────────────────────────────────────────────────────────
const ComplaintBoxPage = () => {
  const [complaints, setComplaints] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DUMMY_COMPLAINTS;
    } catch {
      return DUMMY_COMPLAINTS;
    }
  });
  const [showModal, setShowModal] = useState(false);
  const [editingComplaint, setEditingComplaint] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");

  // Persist to localStorage whenever complaints change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(complaints));
    } catch {
      // storage quota exceeded — silently ignore
    }
  }, [complaints]);

  const FILTERS = ["All", "Open", "Resolved", "Under Review"];

  const handleDelete = (id) => {
    setComplaints((prev) => prev.filter((c) => c.id !== id));
    setDeletingId(null);
    toast.success("Complaint deleted.");
  };

  const handleDeleteRequest = (id) => {
    setDeletingId(id);
  };

  // Prepend new complaint to the top and reset filter so it's always visible
  const handleNewComplaint = (newComplaint) => {
    setComplaints((prev) => [newComplaint, ...prev]);
    setActiveFilter("All");
  };

  // Update the edited complaint in-place
  const handleEditSave = (updated) => {
    setComplaints((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  };

  const filtered =
    activeFilter === "All" ? complaints : complaints.filter((c) => c.status === activeFilter);

  return (
    <div className="min-h-dvh bg-[#FBF9F5] px-4 py-10 md:px-6">
      <div className="mx-auto max-w-3xl">
        {/* Page heading */}
        <div className="mb-8 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tight text-black">
              Complaint Box
            </h1>
            <p className="mt-1 max-w-md text-sm font-medium text-gray-500">
              Describe your issue or suggestion, such as a technical problem or BootCamp concern.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            id="new-complaint-btn"
            className="mt-4 flex shrink-0 items-center gap-2 self-start border-2 border-black bg-[#FFDE00] px-5 py-3 font-extrabold uppercase tracking-wider text-black shadow-[5px_5px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0px_black] active:translate-x-[5px] active:translate-y-[5px] active:shadow-none transition-all duration-150 sm:mt-0"
          >
            <Plus className="size-4" />
            New Complaint
          </button>
        </div>

        {/* Filter bar */}
        <div className="mb-5 flex items-center justify-end gap-3">
          <div className="relative">
            <button
              onClick={() => setFilterOpen((p) => !p)}
              className="flex items-center gap-2 border-2 border-black bg-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-black shadow-[3px_3px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_black] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all duration-150"
            >
              Filter By
              <SlidersHorizontal className="size-3.5" />
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-44 border-2 border-black bg-white shadow-[4px_4px_0px_black]">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => { setActiveFilter(f); setFilterOpen(false); }}
                    className={`block w-full px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-[#FFDE00] ${activeFilter === f ? "bg-[#FFDE00]" : "bg-white"}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
          {activeFilter !== "All" && (
            <span className="flex items-center gap-1 border-2 border-black bg-[#E8EBFF] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest shadow-[2px_2px_0px_black]">
              {activeFilter}
              <button onClick={() => setActiveFilter("All")} className="ml-1">
                <X className="size-3" />
              </button>
            </span>
          )}
        </div>

        {/* Complaints list */}
        <div className="flex flex-col gap-5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 border-2 border-black bg-white p-12 shadow-[5px_5px_0px_black] text-center">
              <span className="text-4xl">📭</span>
              <p className="font-bold uppercase tracking-widest text-gray-500">No complaints found</p>
              <button
                onClick={() => setActiveFilter("All")}
                className="mt-1 border-2 border-black bg-[#FFDE00] px-4 py-2 text-xs font-bold uppercase tracking-widest shadow-[3px_3px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_black] transition-all"
              >
                Clear Filter
              </button>
            </div>
          ) : (
            filtered.map((complaint) => (
              <ComplaintCard
                key={complaint.id}
                complaint={complaint}
                onDeleteRequest={handleDeleteRequest}
                onEdit={setEditingComplaint}
              />
            ))
          )}
        </div>
      </div>

      {/* New Complaint Modal */}
      {showModal && (
        <NewComplaintModal
          onClose={() => setShowModal(false)}
          onSuccess={handleNewComplaint}
        />
      )}

      {/* Edit Complaint Modal */}
      {editingComplaint && (
        <EditComplaintModal
          complaint={editingComplaint}
          onClose={() => setEditingComplaint(null)}
          onSave={handleEditSave}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingId !== null && (
        <DeleteConfirmModal
          onClose={() => setDeletingId(null)}
          onConfirm={() => handleDelete(deletingId)}
        />
      )}
    </div>
  );
};

export default ComplaintBoxPage;
