import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-4 border-2 border-dashed border-ink/40 bg-surface/60 px-6 py-16 text-center"
    >
      {Icon && (
        <div className="border-2 border-ink bg-brand-yellow p-3 text-ink shadow-brutal-sm">
          <Icon className="size-7" />
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-lg font-black uppercase tracking-wide">{title}</h3>
        {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      </div>
      {action}
    </motion.div>
  );
}
