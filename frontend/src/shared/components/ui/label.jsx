
import { cn } from "@/lib/utils"

function Label({
  className,
  ...props
}) {
  return (
    <label
      data-slot="label"
      className={cn(
        "block text-sm font-bold text-black uppercase",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label }
