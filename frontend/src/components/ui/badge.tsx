import { cn } from "@/lib/utils.ts";
import type { Priority } from "@/lib/api.ts";

const styles: Record<Priority, string> = {
  high: "bg-high-bg text-high border-high/30",
  medium: "bg-medium-bg text-medium border-medium/30",
  low: "bg-low-bg text-low border-low/30",
};

/**
 * Priority is communicated by its label first and colour second, so the value
 * is still readable to someone who cannot distinguish the three hues.
 */
export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        styles[priority],
      )}
    >
      {priority}
    </span>
  );
}
