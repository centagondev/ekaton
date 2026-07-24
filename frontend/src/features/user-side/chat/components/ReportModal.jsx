import { useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { reportUserApi } from "../api/chat.api";

// Exact reason values from backend Report.ReportReason
const REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "spam", label: "Spam or advertising" },
  { value: "abusive_language", label: "Hate speech" },
  { value: "fake_identity", label: "Identity reveal attempt" },
  { value: "other", label: "Other" },
];

/**
 * ReportModal
 * @param {string}   roomId   - active chat room UUID
 * @param {()=>void} onClose  - called after cancel or successful submit
 */
const ReportModal = ({ roomId, onClose }) => {
  const [reason, setReason] = useState("harassment");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) return;

    try {
      setSubmitting(true);
      await reportUserApi({
        room_id: roomId,
        reason,
        description: description.trim() || undefined,
      });
      toast.success("Report submitted. Our team will review it shortly.");
      onClose();
    } catch (err) {
      const msg =
        err?.response?.data?.message || "Failed to submit report. Try again.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg border-2 border-black bg-white shadow-[6px_6px_0px_black]">
        {/* Header */}
        <div className="border-b-2 border-black px-6 py-5">
          <h2 className="text-lg font-black uppercase tracking-wide">
            Report Stranger
          </h2>
          <p className="mt-1 text-sm font-medium text-gray-600">
            Please select a reason for reporting this conversation. Our
            moderation team will review it shortly.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Reason list */}
          <div className="space-y-3 px-6 py-5">
            {REASONS.map((r) => (
              <label
                key={r.value}
                className="flex cursor-pointer items-center gap-3"
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="h-4 w-4 accent-[#FFDE00]"
                />
                <span className="text-sm font-medium">{r.label}</span>
              </label>
            ))}
          </div>

          {/* Additional comments */}
          <div className="px-6 pb-4">
            <p className="mb-2 text-xs font-black uppercase tracking-widest">
              Additional Comments
            </p>
            <textarea
              id="report-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide more details..."
              className="w-full border-2 border-black bg-white px-3 py-2.5 text-sm font-medium placeholder-gray-400 focus:outline-none resize-none"
            />
          </div>

          {/* Upload evidence (UI only — no file upload endpoint) */}
          <div className="px-6 pb-5">
            <p className="mb-2 text-xs font-black uppercase tracking-widest">
              Upload Evidence
            </p>
            <div className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-black bg-gray-50 py-6 cursor-not-allowed">
              <Upload size={22} className="text-gray-400" />
              <p className="text-sm font-medium text-gray-500">
                Click to upload screenshots
              </p>
              <p className="text-[11px] text-gray-400">
                Max file size: 5MB. Supported formats: JPG, PNG.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t-2 border-black px-6 py-4">
            <button
              id="report-modal-cancel"
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="border-2 border-black bg-white px-6 py-2.5 text-sm font-bold uppercase shadow-[3px_3px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_black] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              id="report-modal-submit"
              type="submit"
              disabled={submitting || !reason}
              className="bg-brand-yellow border-2 border-black px-6 py-2.5 text-sm font-bold uppercase shadow-[3px_3px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_black] disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportModal;
