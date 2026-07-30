import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { eventsApi, EVENT_BANNERS } from "@/lib/api/events";
import { parseApiError } from "@/lib/errors";
import { storage } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/config";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import type { CampusEvent, EventBanner, EventParticipant } from "@/types/api";

/**
 * The backend stores only a banner slug (banner_1…6) — there are no event
 * images — so the artwork is generated here from CSS patterns.
 */
const BANNER_STYLES: Record<EventBanner, { className: string; pattern: string; size?: string }> = {
  banner_1: {
    className: "bg-brand-yellow",
    pattern: "repeating-linear-gradient(45deg, transparent 0 14px, rgba(10,10,10,.85) 14px 16px)",
  },
  banner_2: {
    className: "bg-brand-lime",
    pattern:
      "radial-gradient(circle at 20% 40%, rgba(10,10,10,.85) 0 8px, transparent 8px), radial-gradient(circle at 60% 70%, rgba(10,10,10,.85) 0 12px, transparent 12px), radial-gradient(circle at 85% 25%, rgba(10,10,10,.85) 0 6px, transparent 6px)",
  },
  banner_3: {
    className: "bg-brand-lavender",
    pattern: "repeating-linear-gradient(0deg, transparent 0 18px, rgba(10,10,10,.8) 18px 20px)",
  },
  banner_4: {
    className: "bg-[#ff6b6b]",
    pattern: "repeating-conic-gradient(rgba(10,10,10,.85) 0 25%, transparent 0 50%)",
    size: "28px 28px",
  },
  banner_5: {
    className: "bg-[#4dabf7]",
    pattern: "repeating-linear-gradient(-45deg, transparent 0 10px, rgba(10,10,10,.85) 10px 12px)",
  },
  banner_6: {
    className: "bg-[#ff9f43]",
    pattern:
      "radial-gradient(circle at 50% 50%, transparent 0 10px, rgba(10,10,10,.85) 10px 12px, transparent 12px 26px)",
    size: "40px 40px",
  },
};

export function EventBannerArt({
  banner,
  className,
}: {
  banner: EventBanner;
  className?: string;
}) {
  const style = BANNER_STYLES[banner] ?? BANNER_STYLES.banner_1;
  return (
    <div
      aria-hidden="true"
      className={cn("relative overflow-hidden border-b-2 border-ink", style.className, className)}
    >
      <div
        className="absolute inset-0 opacity-20"
        style={{ backgroundImage: style.pattern, backgroundSize: style.size }}
      />
    </div>
  );
}

/* ------------------------- local identity memory ------------------------- */

interface StoredIdentity {
  participantId: string;
  displayName: string;
}

/** Remember the anonymous identity handed back by join/ for this event. */
export function rememberEventIdentity(eventId: string, participant: EventParticipant): void {
  const map = storage.get<Record<string, StoredIdentity>>(STORAGE_KEYS.EVENT_IDENTITIES) ?? {};
  map[eventId] = { participantId: participant.id, displayName: participant.display_name };
  storage.set(STORAGE_KEYS.EVENT_IDENTITIES, map);
}

export function getEventIdentity(eventId: string): StoredIdentity | null {
  const map = storage.get<Record<string, StoredIdentity>>(STORAGE_KEYS.EVENT_IDENTITIES) ?? {};
  return map[eventId] ?? null;
}

/* ------------------------------ create/edit ------------------------------ */

interface EventFormValues {
  banner: EventBanner;
  name: string;
  description: string;
  venue: string;
  end_time: string;
  is_anonymous_chat: boolean;
}

function toLocalInputValue(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function EventFormModal({
  open,
  onClose,
  event,
}: {
  open: boolean;
  onClose: () => void;
  event?: CampusEvent;
}) {
  const isEdit = Boolean(event);
  const queryClient = useQueryClient();

  // Errors that belong to no single field — the daily creation limit, for
  // one. Shown inside the modal instead of a toast: the modal covers the
  // screen and stays open with everything the user typed, so a toast that
  // fades after a few seconds is easy to miss.
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<EventFormValues>({
    defaultValues: {
      banner: "banner_1",
      name: "",
      description: "",
      venue: "",
      end_time: "",
      is_anonymous_chat: false,
    },
  });

  useEffect(() => {
    if (open) {
      setFormError(null);
      form.reset({
        banner: event?.banner ?? "banner_1",
        name: event?.name ?? "",
        description: event?.description ?? "",
        venue: event?.venue ?? "",
        end_time: toLocalInputValue(event?.end_time),
        is_anonymous_chat: event?.is_anonymous_chat ?? false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event]);

  const banner = form.watch("banner");
  const anonymous = form.watch("is_anonymous_chat");

  const mutation = useMutation({
    mutationFn: (values: EventFormValues) => {
      const payload = {
        banner: values.banner,
        name: values.name.trim(),
        description: values.description.trim(),
        venue: values.venue.trim(),
        end_time: new Date(values.end_time).toISOString(),
        is_anonymous_chat: values.is_anonymous_chat,
      };
      return isEdit && event
        ? eventsApi.update(event.id, payload)
        : eventsApi.create(payload);
    },
    onMutate: () => setFormError(null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success(isEdit ? "Event updated." : "Event is live!");
      onClose();
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      for (const [key, message] of Object.entries(parsed.fields)) {
        form.setError(key as keyof EventFormValues, { message });
      }
      if (Object.keys(parsed.fields).length === 0) setFormError(parsed.message);
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit event" : "Create new event"}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutateAsync(values).catch(() => {}))}
        className="space-y-4"
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

        <Field label="Event banner">
          {() => (
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Event banner">
              {EVENT_BANNERS.map((slug) => (
                <button
                  key={slug}
                  type="button"
                  role="radio"
                  aria-checked={banner === slug}
                  aria-label={`Banner ${slug.split("_")[1]}`}
                  onClick={() => form.setValue("banner", slug, { shouldDirty: true })}
                  className={cn(
                    "h-14 border-2 transition-all",
                    banner === slug
                      ? "border-ink shadow-brutal-sm"
                      : "border-ink/30 opacity-60 hover:opacity-100",
                  )}
                >
                  <EventBannerArt banner={slug} className="h-full border-b-0" />
                </button>
              ))}
            </div>
          )}
        </Field>

        <Field label="Name" required error={form.formState.errors.name?.message ?? null}>
          {(id) => (
            <Input
              id={id}
              placeholder="Freshers' meetup"
              maxLength={150}
              {...form.register("name", {
                required: "Name is required.",
                maxLength: { value: 150, message: "Max 150 characters." },
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
              placeholder="What's happening?"
              {...form.register("description", { required: "Description is required." })}
            />
          )}
        </Field>

        <Field label="Venue" required error={form.formState.errors.venue?.message ?? null}>
          {(id) => (
            <Input
              id={id}
              placeholder="Main auditorium"
              maxLength={255}
              {...form.register("venue", { required: "Venue is required." })}
            />
          )}
        </Field>

        <Field
          label="Ends at"
          required
          hint="Events have no start time in the backend — only an end time."
          error={form.formState.errors.end_time?.message ?? null}
        >
          {(id) => (
            <Input
              id={id}
              type="datetime-local"
              className="[color-scheme:light]"
              {...form.register("end_time", {
                required: "End time is required.",
                validate: (value) =>
                  new Date(value).getTime() > Date.now() ||
                  "The event end time must be in the future.",
              })}
            />
          )}
        </Field>

        <label className="flex cursor-pointer items-center justify-between gap-3 border-2 border-ink bg-raised px-4 py-3">
          <span className="text-sm font-bold uppercase tracking-wide">Anonymous chat</span>
          <input type="checkbox" className="sr-only" {...form.register("is_anonymous_chat")} />
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
        <p className="-mt-2 text-xs text-muted">
          With anonymous chat on, everyone gets a random alias in the event room.
        </p>

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {isEdit ? "Save changes" : "Create event"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
