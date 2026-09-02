import type { ReactNode } from "react";

import { Label } from "./label.tsx";

/**
 * One labelled form control with its error message.
 *
 * The error is wired up with aria-describedby and role="alert" so it is
 * announced when it appears, not just drawn in red.
 */
export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-fg-muted">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
