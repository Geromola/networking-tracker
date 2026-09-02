import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { PriorityBadge } from "@/components/ui/badge.tsx";
import type { Contact, ListOptions } from "@/lib/api.ts";
import { cn } from "@/lib/utils.ts";

type SortKey = ListOptions["sort"];

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "name", label: "Name" },
  { key: "created_at", label: "Added" },
  { key: "priority", label: "Priority" },
];

/**
 * The contact list, rendered two ways from one data set: a table on wide
 * screens and stacked cards below `md`, where a six-column table would either
 * overflow or become unreadable.
 */
export function ContactList({
  contacts,
  sort,
  order,
  onSort,
  onEdit,
  onDelete,
}: {
  contacts: Contact[];
  sort: SortKey;
  order: "asc" | "desc";
  onSort: (key: SortKey) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}) {
  return (
    <>
      {/* ---------- Mobile: cards ---------- */}
      <ul className="space-y-3 md:hidden">
        {contacts.map((contact) => (
          <li key={contact.id}>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{contact.name}</p>
                  <p className="truncate text-sm text-fg-muted">
                    {[contact.role, contact.company].filter(Boolean).join(" · ") ||
                      "No company yet"}
                  </p>
                </div>
                <PriorityBadge priority={contact.priority} />
              </div>

              {contact.where_met && (
                <p className="mt-3 text-sm">
                  <span className="text-fg-muted">Met at </span>
                  {contact.where_met}
                </p>
              )}
              {contact.notes && (
                <p className="mt-1 text-sm text-fg-muted">{contact.notes}</p>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => onEdit(contact)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => onDelete(contact)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {/* ---------- Desktop: table ---------- */}
      <Card className="hidden overflow-hidden md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              {COLUMNS.map((column) => {
                const active = sort === column.key;
                return (
                  <th key={column.key} scope="col" className="px-4 py-3 font-medium">
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      // aria-sort tells assistive tech what the visual arrow shows.
                      className="inline-flex items-center gap-1 hover:text-fg"
                      aria-label={`Sort by ${column.label}`}
                    >
                      {column.label}
                      <span aria-hidden className={cn("text-xs", !active && "opacity-30")}>
                        {active && order === "asc" ? "▲" : "▼"}
                      </span>
                    </button>
                  </th>
                );
              })}
              <th scope="col" className="px-4 py-3 font-medium">Where you met</th>
              <th scope="col" className="px-4 py-3 font-medium">Notes</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr key={contact.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-xs text-fg-muted">
                    {[contact.role, contact.company].filter(Boolean).join(" · ") || "—"}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-fg-muted">
                  {new Date(contact.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <PriorityBadge priority={contact.priority} />
                </td>
                <td className="max-w-40 truncate px-4 py-3 text-fg-muted">
                  {contact.where_met || "—"}
                </td>
                <td className="max-w-56 truncate px-4 py-3 text-fg-muted">
                  {contact.notes || "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(contact)}
                    aria-label={`Edit ${contact.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(contact)}
                    aria-label={`Delete ${contact.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
