import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Search, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The admin portal's design system — deliberately separate from the product's.
 *
 * The student app is hard-edged neubrutalism (2px ink borders, offset shadows,
 * yellow/lime). The portal is the opposite brief: white surfaces, soft gray
 * hairlines, blue accents, rounded corners — Linear/Stripe, not Bootstrap.
 * Reusing the product's Button/Modal would drag that aesthetic in wholesale,
 * so the portal gets its own small set of primitives and shares only
 * behavioral code (cn, parseApiError, date utils, react-query).
 */

/* --------------------------------- tokens --------------------------------- */

export type BadgeTone = "gray" | "blue" | "green" | "amber" | "red" | "violet";

const BADGE_TONES: Record<BadgeTone, string> = {
  gray: "bg-gray-100 text-gray-700 ring-gray-500/10",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/15",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/15",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/15",
};

export function ABadge({
  tone = "gray",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* --------------------------------- button --------------------------------- */

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "ghostDanger"
  | "ghostSuccess"
  | "danger";

/**
 * cn() is a plain joiner (no tailwind-merge), so callers must never override
 * a variant's colors via className — same-property utilities would race on
 * stylesheet order. Wants a different color scheme? That's a new variant.
 */
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:hover:bg-blue-600",
  secondary:
    "border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900",
  ghost: "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
  ghostDanger: "text-red-600 hover:bg-red-50 hover:text-red-700",
  ghostSuccess: "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700",
  danger:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:hover:bg-red-600",
};

export function AButton({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-3.5 animate-spin" />}
      {children}
    </button>
  );
}

/* ---------------------------------- cards ---------------------------------- */

export function ACard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Compact display for counters: 1,284 → "1,284", 1_240_000 → "1.2M". */
export function formatCount(value: number): string {
  if (value >= 10_000) {
    return new Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return value.toLocaleString("en");
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "blue",
  loading = false,
}: {
  label: string;
  value: number | undefined;
  icon: LucideIcon;
  tone?: BadgeTone;
  loading?: boolean;
}) {
  const iconTone: Record<BadgeTone, string> = {
    gray: "bg-gray-100 text-gray-600",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <ACard className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-gray-500">
            {label}
          </p>
          {loading || value === undefined ? (
            <ASkeleton className="mt-2 h-7 w-16" />
          ) : (
            <p
              className="mt-1 text-2xl font-semibold tracking-tight text-gray-900"
              title={value.toLocaleString("en")}
            >
              {formatCount(value)}
            </p>
          )}
        </div>
        <span className={cn("rounded-lg p-2", iconTone[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
    </ACard>
  );
}

/* ---------------------------------- forms ---------------------------------- */

export function AField({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | null;
  hint?: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[13px] font-medium text-gray-700"
      >
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/**
 * Shared control skin, deliberately without width or horizontal padding —
 * cn() does not merge conflicting utilities, so those are injected through
 * explicit props (widthClass / paddingClass) instead of className overrides.
 */
const CONTROL =
  "rounded-lg border border-gray-300 bg-white text-sm text-gray-900 shadow-sm transition-colors " +
  "placeholder:text-gray-400 hover:border-gray-400 " +
  "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 " +
  "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500";

export function AInput({
  className,
  widthClass = "w-full",
  paddingClass = "px-3",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  widthClass?: string;
  paddingClass?: string;
}) {
  return (
    <input
      className={cn(CONTROL, "h-9", paddingClass, widthClass, className)}
      {...rest}
    />
  );
}

export function ATextarea({
  className,
  widthClass = "w-full",
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  widthClass?: string;
}) {
  return (
    <textarea
      className={cn(
        CONTROL,
        "min-h-24 px-3 py-2 leading-relaxed",
        widthClass,
        className,
      )}
      {...rest}
    />
  );
}

export function ASelect({
  className,
  widthClass = "w-full",
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { widthClass?: string }) {
  return (
    <select
      className={cn(CONTROL, "h-9 pl-2.5 pr-8", widthClass, className)}
      {...rest}
    >
      {children}
    </select>
  );
}

/** Accessible on/off switch for booleans (verified, active, anonymous chat). */
export function AToggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-blue-600" : "bg-gray-200",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left]",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </button>
  );
}

/* --------------------------------- search --------------------------------- */

export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function SearchBox({
  value,
  onChange,
  placeholder,
  busy = false,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  busy?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
      <AInput
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        paddingClass="pl-9 pr-9"
      />
      {busy ? (
        <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-gray-400" />
      ) : (
        value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600"
          >
            <X className="size-4" />
          </button>
        )
      )}
    </div>
  );
}

/* ---------------------------------- table ---------------------------------- */

export function ASkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-gray-100", className)} />
  );
}

/** Generic list-loading placeholder for non-tabular pages. */
export function RowSkeletons({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="space-y-2 px-4 py-4">
          <div className="flex gap-2">
            <ASkeleton className="h-4 w-28" />
            <ASkeleton className="h-4 w-12" />
          </div>
          <ASkeleton className="h-4 w-full" />
          <ASkeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function AEmpty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-400">
        <Icon className="size-5" />
      </span>
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  className?: string;
  render: (row: T) => React.ReactNode;
}

/**
 * The portal's one table. Skeleton rows while loading, a supplied empty state
 * when there is nothing, horizontal scroll on narrow screens — every list page
 * gets identical behavior from the same 60 lines.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  empty,
  onRowClick,
}: {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  empty: React.ReactNode;
  onRowClick?: (row: T) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            {/* Alignment comes from the column or falls back to left — never
                both, since cn() cannot merge text-left/text-right. */}
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-4 py-2.5 text-xs font-medium text-gray-500",
                  column.className ?? "text-left",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 6 }, (_, index) => (
                <tr key={index} className="border-b border-gray-100">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3.5">
                      <ASkeleton className="h-4 w-full max-w-32" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-b border-gray-100 last:border-0",
                    onRowClick && "cursor-pointer transition-colors hover:bg-gray-50",
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn("px-4 py-3", column.className)}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {!loading && rows.length === 0 && empty}
    </div>
  );
}

/** Backend page size is fixed by DefaultPagination unless overridden. */
export const PAGE_SIZE = 10;

export function APagination({
  page,
  count,
  pageSize = PAGE_SIZE,
  onPage,
  busy = false,
}: {
  page: number;
  count: number;
  pageSize?: number;
  onPage: (next: number) => void;
  busy?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  if (count <= pageSize) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);

  return (
    <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-4 py-3">
      <p className="text-xs text-gray-500">
        Showing <span className="font-medium text-gray-700">{from}–{to}</span> of{" "}
        <span className="font-medium text-gray-700">{count.toLocaleString("en")}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <AButton
          variant="secondary"
          size="sm"
          disabled={page <= 1 || busy}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </AButton>
        <span className="px-1.5 text-xs tabular-nums text-gray-500">
          {page} / {totalPages}
        </span>
        <AButton
          variant="secondary"
          size="sm"
          disabled={page >= totalPages || busy}
          onClick={() => onPage(page + 1)}
        >
          Next
        </AButton>
      </div>
    </div>
  );
}

/* ---------------------------------- modal ---------------------------------- */

export function AModal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  // Escape closes; page scroll is parked while any modal is up.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <motion.button
            type="button"
            aria-label="Close dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-gray-950/40"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "relative flex max-h-[85dvh] w-full flex-col rounded-xl border border-gray-200 bg-white shadow-xl",
              wide ? "max-w-2xl" : "max-w-lg",
            )}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  tone = "danger",
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  busy?: boolean;
}) {
  return (
    <AModal open={open} onClose={onClose} title={title}>
      <div className="text-sm text-gray-600">{body}</div>
      <div className="mt-5 flex justify-end gap-2">
        <AButton variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </AButton>
        <AButton variant={tone} onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </AButton>
      </div>
    </AModal>
  );
}

/* ------------------------------- page chrome ------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Local-time value for <input type="datetime-local"> from an ISO string. */
export function toDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
