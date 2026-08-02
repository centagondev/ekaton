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
 * The backend stores only a banner slug (banner_1…6), so each slug is mapped
 * here to its uploaded artwork. The colour + CSS pattern stay as the backdrop
 * the image paints over, so a slow or failed image still looks deliberate.
 */
const BANNER_STYLES: Record<
  EventBanner,
  { className: string; pattern: string; size?: string; image: string; ratio: string }
> = {
  banner_1: {
    className: "bg-brand-yellow",
    pattern: "repeating-linear-gradient(45deg, transparent 0 14px, rgba(10,10,10,.85) 14px 16px)",
    image:
      "https://res.cloudinary.com/v2fz8ui6/image/upload/v1785684609/Gemini_Generated_Image_iorrbfiorrbfiorr_cyxpny.png",
    ratio: "1584 / 672",
  },
  banner_2: {
    className: "bg-brand-lime",
    pattern:
      "radial-gradient(circle at 20% 40%, rgba(10,10,10,.85) 0 8px, transparent 8px), radial-gradient(circle at 60% 70%, rgba(10,10,10,.85) 0 12px, transparent 12px), radial-gradient(circle at 85% 25%, rgba(10,10,10,.85) 0 6px, transparent 6px)",
    image:
      "https://res.cloudinary.com/v2fz8ui6/image/upload/v1785685360/Gemini_Generated_Image_ntmnusntmnusntmn_cvq5up.png",
    ratio: "1792 / 592",
  },
  banner_3: {
    className: "bg-brand-lavender",
    pattern: "repeating-linear-gradient(0deg, transparent 0 18px, rgba(10,10,10,.8) 18px 20px)",
    image:
      "https://res.cloudinary.com/v2fz8ui6/image/upload/v1785681585/Gemini_Generated_Image_50dfpk50dfpk50df_r1zsfe.png",
    ratio: "1584 / 672",
  },
  banner_4: {
    className: "bg-[#ff6b6b]",
    pattern: "repeating-conic-gradient(rgba(10,10,10,.85) 0 25%, transparent 0 50%)",
    size: "28px 28px",
    image:
      "https://res.cloudinary.com/v2fz8ui6/image/upload/v1785685166/Gemini_Generated_Image_ecs86recs86recs8_tvufrt.png",
    ratio: "1584 / 672",
  },
  banner_5: {
    className: "bg-[#4dabf7]",
    pattern: "repeating-linear-gradient(-45deg, transparent 0 10px, rgba(10,10,10,.85) 10px 12px)",
    image:
      "https://res.cloudinary.com/v2fz8ui6/image/upload/v1785681434/Gemini_Generated_Image_ynmqifynmqifynmq_chrv1s.png",
    ratio: "1408 / 768",
  },
  banner_6: {
    className: "bg-[#ff9f43]",
    pattern:
      "radial-gradient(circle at 50% 50%, transparent 0 10px, rgba(10,10,10,.85) 10px 12px, transparent 12px 26px)",
    size: "40px 40px",
    image:
      "https://res.cloudinary.com/v2fz8ui6/image/upload/v1785681727/Gemini_Generated_Image_1pq44a1pq44a1pq4_vx9dl3.png",
    ratio: "1584 / 672",
  },
};

/**
 * The shared banner shape for the card grid, as a Tailwind aspect class.
 *
 * 33/14 is 1584×672 — the size four of the six banners already are, so those
 * four fill a card's banner box exactly and only the two odd ones (1792×592
 * and 1408×768) give up ~22% off one axis to cover. Worth revisiting if the
 * artwork above is ever replaced with a different shape.
 */
export const EVENT_BANNER_RATIO = "aspect-[33/14]";

/**
 * The image always fills its box edge to edge — object-cover, never contain,
 * so no gap can open up around it. What differs is where the box's ratio comes
 * from.
 *
 * `natural` takes it from the banner itself, so cover has nothing to crop and
 * the whole image shows. Use it where one banner owns the full width; the box
 * is then as tall as that image needs, which is why the card grid can't use it
 * — cards there must all be the same height, whatever banner they carry.
 *
 * Everywhere else the caller sets one shared ratio and cover trims the overflow
 * from the banners that don't match it. Pick that ratio to match the artwork
 * (see EVENT_BANNER_RATIO) and most banners come through untouched.
 */
export function EventBannerArt({
  banner,
  className,
  natural = false,
}: {
  banner: EventBanner;
  className?: string;
  natural?: boolean;
}) {
  const style = BANNER_STYLES[banner] ?? BANNER_STYLES.banner_1;
  return (
    <div
      aria-hidden="true"
      className={cn("relative overflow-hidden border-b-2 border-ink", style.className, className)}
      style={natural ? { aspectRatio: style.ratio } : undefined}
    >
      <div
        className="absolute inset-0 opacity-20"
        style={{ backgroundImage: style.pattern, backgroundSize: style.size }}
      />
      {/*
        block: an inline img adds descender space under itself, which shows up
        as a thin strip of background along the bottom edge.
      */}
      <img
        src={style.image}
        alt=""
        loading="lazy"
        decoding="async"
        className="relative block size-full object-cover object-center"
      />
    </div>
  );
}

/* ------------------------- local identity memory ------------------------- */

export interface StoredIdentity {
  participantId: string;
  displayName: string;
}

/**
 * Remember the identity handed back by join/ for this event.
 *
 * Only a cache. The event detail endpoint carries `my_participant`, which is
 * what the chat actually trusts; this just spares the first render from
 * waiting for it, and is meaningless on a device that has never joined here.
 */
export function rememberEventIdentity(
  eventId: string,
  participant: EventParticipant | StoredIdentity,
): void {
  const map = storage.get<Record<string, StoredIdentity>>(STORAGE_KEYS.EVENT_IDENTITIES) ?? {};
  map[eventId] =
    "participantId" in participant
      ? participant
      : { participantId: participant.id, displayName: participant.display_name };
  storage.set(STORAGE_KEYS.EVENT_IDENTITIES, map);
}

export function getEventIdentity(eventId: string): StoredIdentity | null {
  const map = storage.get<Record<string, StoredIdentity>>(STORAGE_KEYS.EVENT_IDENTITIES) ?? {};
  return map[eventId] ?? null;
}

/* ------------------------------ create/edit ------------------------------ */

/**
 * The longest an event may run. An event starts the moment it is created —
 * there is no separate start field — so the window is anchored at creation:
 * "now" while creating, the event's `created_at` while editing. Editing
 * therefore cannot stretch an event past the 24 hours it was entitled to.
 */
const EVENT_MAX_DURATION_MS = 24 * 60 * 60 * 1000;

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
              placeholder="Midnight Maggi & code jam"
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
              placeholder="What's the plan? Who should come, what to bring, is there food…"
              {...form.register("description", { required: "Description is required." })}
            />
          )}
        </Field>

        <Field label="Venue" required error={form.formState.errors.venue?.message ?? null}>
          {(id) => (
            <Input
              id={id}
              placeholder="Canteen, back tables"
              maxLength={255}
              {...form.register("venue", { required: "Venue is required." })}
            />
          )}
        </Field>

        <Field
          label="Ends at"
          required
          hint="When it wraps up, within 24 hours of creating the event. The chat closes then."
          error={form.formState.errors.end_time?.message ?? null}
        >
          {(id) => (
            <Input
              id={id}
              type="datetime-local"
              className="[color-scheme:light]"
              {...form.register("end_time", {
                required: "End time is required.",
                validate: {
                  future: (value) =>
                    new Date(value).getTime() > Date.now() ||
                    "The event end time must be in the future.",
                  within24Hours: (value) => {
                    const startsAt =
                      isEdit && event ? new Date(event.created_at).getTime() : Date.now();
                    return (
                      new Date(value).getTime() - startsAt <= EVENT_MAX_DURATION_MS ||
                      "Events can run for at most 24 hours — pick an earlier end time."
                    );
                  },
                },
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
