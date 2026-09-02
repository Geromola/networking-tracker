import type { ComponentProps } from "react";

import { cn } from "@/lib/utils.ts";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm",
        "placeholder:text-fg-muted focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-ring disabled:opacity-50",
        // aria-invalid drives the error styling, so the visual state and the
        // state announced to a screen reader can never disagree.
        "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/30",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm",
        "placeholder:text-fg-muted focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-ring disabled:opacity-50",
        "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/30",
        className,
      )}
      {...props}
    />
  );
}
