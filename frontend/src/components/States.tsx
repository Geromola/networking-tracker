import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";

/** Skeleton rows. Shaped like the real list so the layout does not jump. */
export function LoadingState() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your contacts…</span>
      {[0, 1, 2].map((row) => (
        <Card key={row} className="flex items-center gap-4 p-4">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Nothing stored yet — distinct from "your filters matched nothing". */
export function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <Card className="flex flex-col items-center px-6 py-16 text-center">
      <div className="rounded-full bg-muted p-3">
        <UserPlus className="h-6 w-6 text-fg-muted" />
      </div>
      <h2 className="mt-4 font-medium">No contacts yet</h2>
      <p className="mt-1 max-w-sm text-sm text-fg-muted">
        Add the first person you want to stay connected with, and they will show
        up here.
      </p>
      <Button className="mt-6" onClick={onAdd}>
        Add your first contact
      </Button>
    </Card>
  );
}

export function NoResultsState({ onClear }: { onClear: () => void }) {
  return (
    <Card className="flex flex-col items-center px-6 py-16 text-center">
      <h2 className="font-medium">No contacts match those filters</h2>
      <p className="mt-1 text-sm text-fg-muted">
        Try a different search term or priority.
      </p>
      <Button variant="outline" className="mt-6" onClick={onClear}>
        Clear filters
      </Button>
    </Card>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="flex flex-col items-center px-6 py-16 text-center" role="alert">
      <h2 className="font-medium text-danger">Could not load your contacts</h2>
      <p className="mt-1 max-w-sm text-sm text-fg-muted">{message}</p>
      <Button variant="outline" className="mt-6" onClick={onRetry}>
        Try again
      </Button>
    </Card>
  );
}
