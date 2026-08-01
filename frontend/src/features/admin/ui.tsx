import { useCallback, useEffect, useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  CheckCircle2,
  Info,
  Moon,
  Search,
  Sun,
  TriangleAlert,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The admin portal's design system — deliberately separate from the product's.
 *
 * The student app is hard-edged neubrutalism (2px ink borders, offset shadows,
 * yellow/lime). The portal is the opposite brief: soft surfaces, hairline
 * borders, blue accents, rounded corners — Linear/Stripe, not Bootstrap.
 *
 * Every color in here is a semantic token (`a-*`) declared in
 * styles/index.css under [data-admin]; dark mode is nothing but a second set
 * of values behind [data-admin-theme="dark"], so no component carries
 * dark-variant classes. Never use raw palette classes (gray-*, blue-*, white)
 * in admin code — that is what breaks theming.
 */

/* --------------------------------- theme ---------------------------------- */

const THEME_KEY = "ekaton:admin-theme";

export type AdminTheme = "light" | "dark";

/** Read the persisted theme — dark is the portal's default appearance. */
export function getStoredAdminTheme(): AdminTheme {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/**
 * Theme state for an admin root. The value is persisted so the choice
 * survives reloads and applies to the login screen too. Components don't
 * consume this directly — the root element carries data-admin-theme and CSS
 * does the rest.
 */
export function useAdminTheme(): [AdminTheme, () => void] {
  const [theme, setTheme] = useState<AdminTheme>(getStoredAdminTheme);
  const toggle = useCallback(() => {
    setTheme((previous) => {
      const next = previous === "light" ? "dark" : "light";
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* preference simply won't survive a reload */
      }
      return next;
    });
  }, []);
  return [theme, toggle];
}

export function ThemeToggle({
  theme,
  onToggle,
  className,
}: {
  theme: AdminTheme;
  onToggle: () => void;
  className?: string;
}) {
  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={onToggle}
      className={cn(
        "flex size-9 items-center justify-center rounded-lg text-a-muted transition-colors",
        "hover:bg-a-raised hover:text-a-ink",
        className,
      )}
    >
      {/* Key swap gives the icon a tiny pop without a bespoke animation. */}
      <motion.span
        key={theme}
        initial={{ scale: 0.6, rotate: -30, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="flex"
      >
        {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </motion.span>
    </button>
  );
}

/** True below the `sm` breakpoint — drives the modal/bottom-sheet split. */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 639px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const onChange = (event: MediaQueryListEvent) => setMobile(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

/* --------------------------------- badges --------------------------------- */

export type BadgeTone = "gray" | "blue" | "green" | "amber" | "red" | "violet";

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
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium",
        `a-tone-${tone}`,
        className,
      )}
    >
      {children}
    </span>
  );
}

/* --------------------------------- spinner -------------------------------- */

/**
 * The portal's one loading indicator: a plain border spinner that takes the
 * current text color, so it reads white inside primary buttons and muted
 * inside inputs without any per-context styling.
 */
export function ASpinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80",
        className,
      )}
    />
  );
}

/** Suspense / route-level fallback — small and centered, never a splash. */
export function AdminPageLoader() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center text-a-faint">
      <ASpinner className="size-6" />
    </div>
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
    "bg-a-accent text-white a-elev hover:bg-a-accent-strong disabled:hover:bg-a-accent",
  secondary:
    "border border-a-line-strong bg-a-surface text-a-text a-elev hover:bg-a-raised hover:text-a-ink",
  ghost: "text-a-muted hover:bg-a-raised hover:text-a-ink",
  ghostDanger: "text-a-danger-text hover:bg-a-danger-soft",
  ghostSuccess:
    "text-[var(--a-tone-green-text)] hover:bg-[var(--a-tone-green-bg)]",
  danger:
    "bg-a-danger text-white a-elev hover:bg-a-danger-strong disabled:hover:bg-a-danger",
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
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium",
        // Transform is animated per-button (the scoped [data-admin] rule only
        // transitions colors); the press scale is the tactile feedback.
        "transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150",
        "active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
        // Comfortable 40/44px touch targets on phones, compact on desktop.
        size === "sm"
          ? "h-10 px-3 text-[13px] sm:h-8 sm:px-2.5 sm:text-xs"
          : "h-11 px-4 text-sm sm:h-9 sm:px-3.5",
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading && <ASpinner className="size-3.5" />}
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
        "rounded-xl border border-a-line bg-a-surface a-elev",
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
  return (
    <ACard className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-a-muted sm:text-[13px]">
            {label}
          </p>
          {loading || value === undefined ? (
            <ASkeleton className="mt-2 h-7 w-16" />
          ) : (
            <p
              className="mt-1 text-xl font-semibold tracking-tight text-a-ink sm:text-2xl"
              title={value.toLocaleString("en")}
            >
              {formatCount(value)}
            </p>
          )}
        </div>
        <span className={cn("rounded-lg p-2", `a-chip-${tone}`)}>
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
        className="mb-1.5 block text-[13px] font-medium text-a-text"
      >
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="mt-1.5 text-xs text-a-muted">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-a-danger-text">{error}</p>}
    </div>
  );
}

/**
 * Shared control skin, deliberately without width or horizontal padding —
 * cn() does not merge conflicting utilities, so those are injected through
 * explicit props (widthClass / paddingClass) instead of className overrides.
 *
 * text-base on phones is load-bearing: iOS Safari zooms the page on focusing
 * any input under 16px.
 */
const CONTROL =
  "rounded-lg border border-a-line-strong bg-a-surface text-a-ink transition-colors " +
  "placeholder:text-a-faint hover:border-a-faint " +
  "focus:border-a-accent focus:outline-none focus:ring-2 focus:ring-a-accent-soft " +
  "disabled:cursor-not-allowed disabled:bg-a-raised disabled:text-a-muted";

const CONTROL_HEIGHT = "h-11 text-base sm:h-9 sm:text-sm";

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
      className={cn(CONTROL, CONTROL_HEIGHT, paddingClass, widthClass, className)}
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
        "min-h-24 px-3 py-2 text-base leading-relaxed sm:text-sm",
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
      className={cn(CONTROL, CONTROL_HEIGHT, "pl-2.5 pr-8", widthClass, className)}
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
      className="flex min-h-10 items-center gap-2.5 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-a-accent" : "bg-a-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left] duration-150",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </span>
      <span className="text-sm font-medium text-a-text">{label}</span>
    </button>
  );
}

/* --------------------------------- search --------------------------------- */

export function useDebouncedValue<T>(value: T, delayMs = 250): T {
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
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-a-faint" />
      <AInput
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        // a-search hides WebKit's native cancel button — the X below is the
        // only clear control, not a duplicate of it.
        className="a-search"
        paddingClass="pl-9 pr-10"
      />
      {busy ? (
        <ASpinner className="absolute right-3 top-1/2 -translate-y-1/2 text-a-faint" />
      ) : (
        value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onChange("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-a-faint transition-colors hover:text-a-text"
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
    <div className={cn("animate-pulse rounded-md bg-a-raised", className)} />
  );
}

/** Generic list-loading placeholder for non-tabular pages. */
export function RowSkeletons({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-a-line">
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
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center sm:py-16">
      <span className="mb-3 rounded-xl border border-a-line bg-a-raised p-3 text-a-faint">
        <Icon className="size-5" />
      </span>
      <p className="text-sm font-semibold text-a-ink">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm break-words text-sm text-a-muted">{description}</p>
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
 * The portal's one collection view.
 *
 * From `md` up it renders the classic table. Below `md` the same column
 * definitions become stacked cards — the first column is the card's header,
 * string-headed columns become label/value rows, and columns without a string
 * header (the actions cell) become the card's footer. No page defines its
 * layout twice, and phones never see a sideways-scrolling table.
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
  const [headColumn, ...restColumns] = columns;

  const interactive = onRowClick
    ? {
        role: "button" as const,
        tabIndex: 0,
        onKeyDown: (event: React.KeyboardEvent, row: T) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onRowClick(row);
          }
        },
      }
    : null;

  return (
    <div>
      {/* md+ table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-a-line bg-a-raised/60">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "px-4 py-2.5 text-xs font-medium text-a-muted",
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
                  <tr key={index} className="border-b border-a-line/70">
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
                    {...(interactive
                      ? {
                          role: interactive.role,
                          tabIndex: interactive.tabIndex,
                          onKeyDown: (event: React.KeyboardEvent) =>
                            interactive.onKeyDown(event, row),
                        }
                      : {})}
                    className={cn(
                      "border-b border-a-line/70 last:border-0",
                      onRowClick &&
                        "cursor-pointer transition-colors hover:bg-a-raised/60",
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
      </div>

      {/* <md card list */}
      <div className="md:hidden">
        {loading ? (
          <div className="divide-y divide-a-line">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="space-y-2.5 p-4">
                <ASkeleton className="h-5 w-2/3" />
                <ASkeleton className="h-4 w-full" />
                <ASkeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-a-line">
            {rows.map((row) => (
              <div
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                {...(interactive
                  ? {
                      role: interactive.role,
                      tabIndex: interactive.tabIndex,
                      onKeyDown: (event: React.KeyboardEvent) =>
                        interactive.onKeyDown(event, row),
                    }
                  : {})}
                className={cn(
                  "space-y-3 px-4 py-3.5",
                  onRowClick &&
                    "cursor-pointer transition-colors active:bg-a-raised/70",
                )}
              >
                {headColumn && <div>{headColumn.render(row)}</div>}
                {restColumns.map((column) => {
                  const label =
                    typeof column.header === "string" ? column.header : null;
                  const content = column.render(row);
                  if (label === null) {
                    // Actions cell — right-aligned footer, no label.
                    return (
                      <div
                        key={column.key}
                        className="flex justify-end border-t border-a-line/70 pt-3"
                      >
                        {content}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={column.key}
                      className="flex min-h-6 items-center justify-between gap-4"
                    >
                      <span className="shrink-0 text-xs font-medium text-a-muted">
                        {label}
                      </span>
                      <div className="flex min-w-0 items-center justify-end text-sm text-a-text">
                        {content}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

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
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-a-line px-4 py-3">
      <p className="text-xs text-a-muted">
        <span className="font-medium text-a-text">
          {from}–{to}
        </span>{" "}
        of{" "}
        <span className="font-medium text-a-text">
          {count.toLocaleString("en")}
        </span>
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
        <span className="px-1.5 text-xs tabular-nums text-a-muted">
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

/**
 * Centered dialog on desktop, full-width bottom sheet on phones — one
 * component, one call site API, chosen by viewport. The sheet slides up from
 * the bottom edge, rounds only its top corners, scrolls internally and pads
 * for the home-indicator safe area.
 */
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
  const isMobile = useIsMobile();

  // Escape closes; page scroll is parked while any modal is up. Removing the
  // scrollbar shifts the desktop layout, so its width is compensated.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          data-admin
          data-admin-theme={getStoredAdminTheme()}
          className="fixed inset-0 z-50 flex items-end justify-center bg-transparent sm:items-center sm:p-4"
        >
          <motion.button
            type="button"
            aria-label="Close dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={
              isMobile ? { y: "100%" } : { opacity: 0, scale: 0.97, y: 8 }
            }
            animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.97, y: 8 }}
            transition={
              isMobile
                ? { type: "tween", duration: 0.28, ease: [0.32, 0.72, 0, 1] }
                : { duration: 0.15, ease: "easeOut" }
            }
            className={cn(
              "relative flex w-full flex-col border-a-line bg-a-surface a-elev-lg",
              // Sheet on phones…
              "max-h-[92dvh] rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)]",
              // …dialog on desktop.
              "sm:max-h-[85dvh] sm:rounded-xl sm:border sm:pb-0",
              wide ? "sm:max-w-2xl" : "sm:max-w-lg",
            )}
          >
            {/* Sheet grab handle — phones only. */}
            <div className="pt-2.5 sm:hidden" aria-hidden>
              <div className="mx-auto h-1 w-9 rounded-full bg-a-line-strong" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 sm:border-b sm:border-a-line sm:px-5 sm:py-3.5">
              <h2 className="text-[15px] font-semibold text-a-ink">{title}</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="-m-2 rounded-lg p-2 text-a-faint transition-colors hover:bg-a-raised hover:text-a-text"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-4 pb-4 pt-1 sm:px-5 sm:py-4">
              {children}
            </div>
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
      <div className="text-sm leading-relaxed text-a-text">{body}</div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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

/* ---------------------------------- toasts --------------------------------- */

type ToastKind = "success" | "error" | "warning" | "info";

const TOAST_META: Record<
  ToastKind,
  { icon: LucideIcon; chip: string; role: "status" | "alert" }
> = {
  success: { icon: CheckCircle2, chip: "a-chip-green", role: "status" },
  error: { icon: XCircle, chip: "a-chip-red", role: "alert" },
  warning: { icon: TriangleAlert, chip: "a-chip-amber", role: "alert" },
  info: { icon: Info, chip: "a-chip-blue", role: "status" },
};

function AdminToastCard({
  kind,
  message,
  description,
  onDismiss,
}: {
  kind: ToastKind;
  message: string;
  description?: string;
  onDismiss: () => void;
}) {
  const meta = TOAST_META[kind];
  const Icon = meta.icon;
  return (
    // data-admin re-establishes the token scope (the Toaster mounts outside
    // the admin tree); data-admin-toast lets index.css strip the product
    // Toaster's brutalist frame from around this card.
    <div
      data-admin
      data-admin-theme={getStoredAdminTheme()}
      data-admin-toast
      className="bg-transparent"
    >
      <div
        role={meta.role}
        className="flex w-[356px] max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border border-a-line bg-a-surface p-3.5 a-elev-md"
      >
        <span className={cn("mt-px rounded-lg p-1.5", meta.chip)}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-medium leading-snug text-a-ink">
            {message}
          </p>
          {description && (
            <p className="mt-0.5 text-[13px] leading-snug text-a-muted">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={onDismiss}
          className="-m-1.5 rounded-md p-1.5 text-a-faint transition-colors hover:text-a-text"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function pushToast(kind: ToastKind, message: string, description?: string) {
  toast.custom(
    (id) => (
      <AdminToastCard
        kind={kind}
        message={message}
        description={description}
        onDismiss={() => toast.dismiss(id)}
      />
    ),
    { duration: kind === "error" ? 5000 : 3500 },
  );
}

/**
 * The portal's notification voice — success / error / warning / info, each
 * with its own icon and tone, themed like the rest of the admin. Pages use
 * this instead of sonner's `toast` directly.
 */
export const notify = {
  success: (message: string, description?: string) =>
    pushToast("success", message, description),
  error: (message: string, description?: string) =>
    pushToast("error", message, description),
  warning: (message: string, description?: string) =>
    pushToast("warning", message, description),
  info: (message: string, description?: string) =>
    pushToast("info", message, description),
};

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
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3 sm:mb-6">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight text-a-ink sm:text-xl">
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 text-[13px] text-a-muted sm:mt-1 sm:text-sm">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/** Wraps page content in a gentle entrance so navigation feels alive. */
export function PageEnter({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

/** Local-time value for <input type="datetime-local"> from an ISO string. */
export function toDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
