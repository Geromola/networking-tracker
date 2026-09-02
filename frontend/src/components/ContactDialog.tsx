import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Field } from "@/components/ui/field.tsx";
import { Input, Textarea } from "@/components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { ApiError, type Contact, type ContactDraft, type Priority } from "@/lib/api.ts";

const EMPTY: ContactDraft = {
  name: "",
  company: "",
  role: "",
  where_met: "",
  notes: "",
  priority: "medium",
};

function draftFrom(contact: Contact | null): ContactDraft {
  if (!contact) return EMPTY;
  return {
    name: contact.name,
    company: contact.company ?? "",
    role: contact.role ?? "",
    where_met: contact.where_met ?? "",
    notes: contact.notes ?? "",
    priority: contact.priority,
  };
}

/**
 * Add/edit form. The same dialog handles both; `contact` being null is what
 * makes it a create.
 *
 * Field errors come back from the backend rather than being re-derived here —
 * the server is the authority on what is valid, and this keeps the two from
 * drifting apart.
 */
export function ContactDialog({
  open,
  onOpenChange,
  contact,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onSave: (draft: ContactDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ContactDraft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Reset whenever the dialog opens so a cancelled edit is not carried over.
  useEffect(() => {
    if (open) {
      setDraft(draftFrom(contact));
      setErrors({});
    }
  }, [open, contact]);

  const set = <K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      await onSave(draft);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(
          Object.keys(err.fields).length ? err.fields : { form: err.message },
        );
      } else {
        setErrors({ form: "Something went wrong. Please try again." });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{contact ? "Edit contact" : "Add contact"}</DialogTitle>
          <DialogDescription>
            Only your name is required. Everything else you can fill in later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Field id="contact-name" label="Name" error={errors.name}>
            <Input
              id="contact-name"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "contact-name-error" : undefined}
              placeholder="Ada Lovelace"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="contact-company" label="Company" error={errors.company}>
              <Input
                id="contact-company"
                value={draft.company}
                onChange={(e) => set("company", e.target.value)}
                aria-invalid={Boolean(errors.company)}
                placeholder="Anthropic"
              />
            </Field>

            <Field id="contact-role" label="Role" error={errors.role}>
              <Input
                id="contact-role"
                value={draft.role}
                onChange={(e) => set("role", e.target.value)}
                aria-invalid={Boolean(errors.role)}
                placeholder="Product Manager"
              />
            </Field>
          </div>

          <Field id="contact-where" label="Where you met" error={errors.where_met}>
            <Input
              id="contact-where"
              value={draft.where_met}
              onChange={(e) => set("where_met", e.target.value)}
              aria-invalid={Boolean(errors.where_met)}
              placeholder="Haas AI mixer, Chou Hall"
            />
          </Field>

          <Field id="contact-priority" label="Priority" error={errors.priority}>
            <Select
              value={draft.priority}
              onValueChange={(value) => set("priority", value as Priority)}
            >
              <SelectTrigger id="contact-priority" aria-invalid={Boolean(errors.priority)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field id="contact-notes" label="Notes" error={errors.notes}>
            <Textarea
              id="contact-notes"
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              aria-invalid={Boolean(errors.notes)}
              placeholder="Wants to talk about energy storage. Follow up in two weeks."
            />
          </Field>

          {errors.form && (
            <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
              {errors.form}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : contact ? "Save changes" : "Add contact"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
