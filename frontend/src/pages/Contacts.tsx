import { LogOut, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ContactDialog } from "@/components/ContactDialog.tsx";
import { ContactList } from "@/components/ContactList.tsx";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  NoResultsState,
} from "@/components/States.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  ApiError,
  createContact,
  deleteContact,
  listContacts,
  updateContact,
  type Contact,
  type ContactDraft,
  type ListOptions,
} from "@/lib/api.ts";
import type { SessionUser } from "@/lib/session.ts";

const DEFAULT_OPTIONS: ListOptions = {
  sort: "created_at",
  order: "desc",
  priority: "all",
  search: "",
};

type Status = "loading" | "ready" | "error";

export function Contacts({
  user,
  onSignOut,
}: {
  user: SessionUser;
  onSignOut: () => void;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [options, setOptions] = useState<ListOptions>(DEFAULT_OPTIONS);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [editing, setEditing] = useState<Contact | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Contact | null>(null);

  const load = useCallback(async (next: ListOptions) => {
    setStatus("loading");
    try {
      setContacts(await listContacts(next));
      setStatus("ready");
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError ? err.message : "Something went wrong.",
      );
      setStatus("error");
    }
  }, []);

  // Sorting and filtering happen in Postgres, so any change re-queries.
  // The search box is debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => void load(options), options.search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [options, load]);

  const update = (patch: Partial<ListOptions>) =>
    setOptions((current) => ({ ...current, ...patch }));

  /** Clicking the active column flips direction; a new column starts ascending. */
  const handleSort = (key: ListOptions["sort"]) =>
    update(
      key === options.sort
        ? { order: options.order === "asc" ? "desc" : "asc" }
        : { sort: key, order: "asc" },
    );

  async function handleSave(draft: ContactDraft) {
    // Errors deliberately propagate: ContactDialog turns them into field errors.
    if (editing) {
      await updateContact(editing.id, draft);
      toast.success("Contact updated.");
    } else {
      await createContact(draft);
      toast.success("Contact added.");
    }
    await load(options);
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteContact(target.id);
      toast.success(`Deleted ${target.name}.`);
      await load(options);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete that contact.");
    }
  }

  const filtersActive = options.priority !== "all" || options.search.trim() !== "";

  return (
    <div className="min-h-full">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              Networking Tracker
            </h1>
            <p className="truncate text-xs text-fg-muted">{user.email}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onSignOut}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
            />
            <Input
              type="search"
              className="pl-9"
              placeholder="Search name or company"
              aria-label="Search contacts"
              value={options.search}
              onChange={(e) => update({ search: e.target.value })}
            />
          </div>

          <Select
            value={options.priority}
            onValueChange={(value) =>
              update({ priority: value as ListOptions["priority"] })
            }
          >
            <SelectTrigger className="sm:w-44" aria-label="Filter by priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add contact
          </Button>
        </div>

        {status === "loading" && <LoadingState />}
        {status === "error" && (
          <ErrorState message={errorMessage} onRetry={() => void load(options)} />
        )}
        {status === "ready" && contacts.length === 0 && filtersActive && (
          <NoResultsState onClear={() => setOptions(DEFAULT_OPTIONS)} />
        )}
        {status === "ready" && contacts.length === 0 && !filtersActive && (
          <EmptyState
            onAdd={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          />
        )}
        {status === "ready" && contacts.length > 0 && (
          <ContactList
            contacts={contacts}
            sort={options.sort}
            order={options.order}
            onSort={handleSort}
            onEdit={(contact) => {
              setEditing(contact);
              setDialogOpen(true);
            }}
            onDelete={setPendingDelete}
          />
        )}
      </main>

      <ContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contact={editing}
        onSave={handleSave}
      />

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this contact?</DialogTitle>
            <DialogDescription>
              {pendingDelete?.name} will be removed permanently. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
