import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowBigUp } from "lucide-react";
import {
  complaintsApi,
  COMPLAINT_CATEGORIES,
  COMPLAINT_MAX_BODY,
  COMPLAINT_MAX_TITLE,
  COMPLAINT_STATUS_META,
} from "@/lib/api/complaints";
import { parseApiError } from "@/lib/errors";
import { storage } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/config";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import type { Complaint, ComplaintCategory, ComplaintStatus } from "@/types/api";

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  const meta = COMPLAINT_STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function CategoryBadge({ category }: { category: ComplaintCategory }) {
  const label = COMPLAINT_CATEGORIES.find((item) => item.value === category)?.label ?? category;
  return <Badge tone="neutral">{label}</Badge>;
}

/* --------------------------- local ownership map -------------------------- */

/**
 * Complaint responses never include the author's user id, so ownership can't
 * be derived. We remember ids created in this browser to know when to offer
 * the 5-minute edit window (the backend still enforces both rules).
 */
export function rememberMyComplaint(id: string, createdAt: string): void {
  const mine = storage.get<Record<string, string>>(STORAGE_KEYS.MY_COMPLAINTS) ?? {};
  mine[id] = createdAt;
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, value] of Object.entries(mine)) {
    if (new Date(value).getTime() < cutoff) delete mine[key];
  }
  storage.set(STORAGE_KEYS.MY_COMPLAINTS, mine);
}

export function isMyComplaint(id: string): boolean {
  const mine = storage.get<Record<string, string>>(STORAGE_KEYS.MY_COMPLAINTS) ?? {};
  return id in mine;
}

export function forgetMyComplaint(id: string): void {
  const mine = storage.get<Record<string, string>>(STORAGE_KEYS.MY_COMPLAINTS) ?? {};
  delete mine[id];
  storage.set(STORAGE_KEYS.MY_COMPLAINTS, mine);
}

/* -------------------------------- upvote --------------------------------- */

/**
 * The API exposes no "have I upvoted?" flag, so the pressed state is only
 * known after toggling in this session; counts always come from the server.
 */
export function UpvoteButton({
  complaintId,
  count,
  className,
}: {
  complaintId: string;
  count: number;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [pressed, setPressed] = useState<boolean | null>(null);

  const mutation = useMutation({
    mutationFn: () => complaintsApi.toggleUpvote(complaintId),
    onSuccess: (result) => {
      setPressed(result.upvote);
      void queryClient.invalidateQueries({ queryKey: ["complaints"] });
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      aria-pressed={pressed === true}
      aria-label="Toggle upvote"
      onClick={(clickEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
        if (!mutation.isPending) mutation.mutate();
      }}
      className={cn(
        "flex items-center gap-1.5 border-2 px-3 py-1.5 font-mono text-xs font-bold transition-colors",
        pressed
          ? "border-ink bg-brand-yellow shadow-brutal-sm"
          : "border-ink bg-surface hover:bg-raised",
        className,
      )}
    >
      <ArrowBigUp className={cn("size-4", pressed && "fill-ink")} />
      {count}
    </motion.button>
  );
}

/* ------------------------------ create/edit ------------------------------ */

interface ComplaintFormValues {
  title: string;
  description: string;
  category: ComplaintCategory;
  is_anonymous: boolean;
}

export function ComplaintFormModal({
  open,
  onClose,
  complaint,
}: {
  open: boolean;
  onClose: () => void;
  complaint?: Complaint;
}) {
  const isEdit = Boolean(complaint);
  const queryClient = useQueryClient();

  const form = useForm<ComplaintFormValues>({
    defaultValues: {
      title: "",
      description: "",
      category: "general",
      is_anonymous: true,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title: complaint?.title ?? "",
        description: complaint?.description ?? "",
        category: complaint?.category ?? "general",
        is_anonymous: complaint?.is_anonymous ?? true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, complaint]);

  const anonymous = form.watch("is_anonymous");

  const mutation = useMutation({
    mutationFn: async (values: ComplaintFormValues) => {
      const payload = {
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category,
      };
      if (isEdit && complaint) return complaintsApi.update(complaint.id, payload);
      const created = await complaintsApi.create({
        ...payload,
        is_anonymous: values.is_anonymous,
      });
      rememberMyComplaint(created.id, new Date().toISOString());
      return created;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["complaints"] });
      toast.success(isEdit ? "Complaint updated." : "Complaint posted.");
      onClose();
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      for (const [key, message] of Object.entries(parsed.fields)) {
        form.setError(key as keyof ComplaintFormValues, { message });
      }
      if (Object.keys(parsed.fields).length === 0) toast.error(parsed.message);
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit complaint" : "New complaint"}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutateAsync(values).catch(() => {}))}
        className="space-y-4"
        noValidate
      >
        <Field label="Title" required error={form.formState.errors.title?.message ?? null}>
          {(id) => (
            <Input
              id={id}
              placeholder="What's the issue?"
              maxLength={COMPLAINT_MAX_TITLE}
              {...form.register("title", {
                required: "Title is required.",
                maxLength: { value: COMPLAINT_MAX_TITLE, message: "Max 150 characters." },
              })}
            />
          )}
        </Field>

        <Field
          label="Description"
          required
          error={form.formState.errors.description?.message ?? null}
        >
          {(id) => (
            <Textarea
              id={id}
              placeholder="Give the details — what, where, since when…"
              maxLength={COMPLAINT_MAX_BODY}
              {...form.register("description", {
                required: "Description is required.",
                maxLength: { value: COMPLAINT_MAX_BODY, message: "Max 2000 characters." },
              })}
            />
          )}
        </Field>

        <Field label="Category">
          {(id) => (
            <Select id={id} {...form.register("category")}>
              {COMPLAINT_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {!isEdit && (
          <label className="flex cursor-pointer items-center justify-between gap-3 border-2 border-ink bg-raised px-4 py-3">
            <span className="text-sm font-bold uppercase tracking-wide">Post anonymously</span>
            <input type="checkbox" className="sr-only" {...form.register("is_anonymous")} />
            <span
              aria-hidden="true"
              className={cn(
                "relative h-6 w-12 border-2 border-ink transition-colors",
                anonymous ? "bg-brand-lime" : "bg-surface",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-4 bg-ink transition-all",
                  anonymous ? "left-[1.625rem]" : "left-0.5",
                )}
              />
            </span>
          </label>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {isEdit ? "Save changes" : "Post it"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
