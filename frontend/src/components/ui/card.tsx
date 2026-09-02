import type { ComponentProps } from "react";

import { cn } from "@/lib/utils.ts";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
