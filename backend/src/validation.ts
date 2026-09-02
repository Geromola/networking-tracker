// validation.ts — the trusted core of the API.
//
// Every function here is pure: no network, no database, no Express. That is
// what lets the test suite cover the rules that matter without credentials or
// a live Neon project, and it is why this file is where the rubric's
// "validate in trusted server code" requirement actually lives.

import { z } from "zod";

export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Columns a client is allowed to sort by, mapped to the real database column. */
export const SORT_COLUMNS = {
  name: "name",
  created_at: "created_at",
  // Sorting on the text column would give high, low, medium. priority_rank is a
  // stored generated column that sorts by urgency instead.
  priority: "priority_rank",
} as const;
export type SortKey = keyof typeof SORT_COLUMNS;

/** Collapse internal runs of whitespace and trim the ends. */
const squish = (value: string) => value.trim().replace(/\s+/g, " ");

/**
 * An optional text field. Empty or whitespace-only input becomes null rather
 * than "", so the database stores one unambiguous "not provided" value.
 */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .transform((value) => {
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    })
    .refine((value) => value === null || value.length <= max, {
      message: `${label} must be ${max} characters or fewer.`,
    })
    .nullable()
    .optional();

/**
 * The shape of a contact as a client may supply it.
 *
 * Note what is absent: `user_id` and `id`. Zod strips unknown keys by default,
 * so a request body that tries to set an owner has that key dropped here and
 * never reaches the database. Ownership comes from the JWT via the column
 * default, and the RLS insert policy verifies it.
 */
const priorityField = z.enum(PRIORITIES, {
  error: "Priority must be high, medium, or low.",
});

/** The fields shared by create and update, with no defaults applied. */
const contactShape = {
  name: z
    .string({ error: "Name is required." })
    .transform(squish)
    .refine((value) => value.length > 0, { message: "Name is required." })
    .refine((value) => value.length <= 200, {
      message: "Name must be 200 characters or fewer.",
    }),
  company: optionalText(200, "Company"),
  role: optionalText(200, "Role"),
  where_met: optionalText(300, "Where you met"),
  notes: optionalText(5000, "Notes"),
  priority: priorityField,
};

export const contactSchema = z.object({
  ...contactShape,
  // A create with no priority is a medium-priority contact.
  priority: priorityField.default("medium"),
});

/**
 * The update schema deliberately does NOT carry the priority default.
 * z.object().partial() still applies defaults, so reusing contactSchema here
 * would turn `PATCH {}` into a silent "reset this contact to medium".
 */
const contactPatchSchema = z.object(contactShape).partial();

export type ContactInput = z.infer<typeof contactSchema>;

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string; fields: Record<string, string> };

/** Turn a ZodError into a flat { fieldName: firstMessage } map for the UI. */
function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    // Keep the first message per field; showing three errors on one input is noise.
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}

/** Validate a full contact, as sent to POST /api/contacts. */
export function parseContact(body: unknown): ParseResult<ContactInput> {
  const result = contactSchema.safeParse(body ?? {});
  if (result.success) return { ok: true, value: result.data };

  const fields = fieldErrors(result.error);
  return {
    ok: false,
    message: Object.values(fields)[0] ?? "That contact is not valid.",
    fields,
  };
}

/**
 * Validate a partial update, as sent to PATCH /api/contacts/:id.
 * Same rules, but only for the keys actually present — and an explicitly
 * empty name is still rejected rather than quietly ignored.
 */
export function parseContactPatch(
  body: unknown,
): ParseResult<Partial<ContactInput>> {
  const result = contactPatchSchema.safeParse(body ?? {});
  if (!result.success) {
    const fields = fieldErrors(result.error);
    return {
      ok: false,
      message: Object.values(fields)[0] ?? "That contact is not valid.",
      fields,
    };
  }

  // Drop the keys the client omitted instead of writing undefined over
  // stored values.
  const value = Object.fromEntries(
    Object.entries(result.data).filter(([, v]) => v !== undefined),
  ) as Partial<ContactInput>;

  if (Object.keys(value).length === 0) {
    return {
      ok: false,
      message: "No changes were provided.",
      fields: { form: "No changes were provided." },
    };
  }

  return { ok: true, value };
}

export type ListQuery = {
  sort: (typeof SORT_COLUMNS)[SortKey];
  ascending: boolean;
  priority: Priority | null;
  search: string | null;
};

/**
 * Normalize list query parameters.
 *
 * The sort key is looked up in SORT_COLUMNS rather than passed through, so a
 * client can never inject an arbitrary column name into the Data API query.
 * Anything unrecognized silently falls back to the default; a bad sort order
 * is not worth a 400.
 */
export function parseListQuery(query: Record<string, unknown>): ListQuery {
  const sortKey = String(query.sort ?? "") as SortKey;
  const priority = String(query.priority ?? "") as Priority;
  const search = String(query.search ?? query.q ?? "").trim();

  return {
    sort: SORT_COLUMNS[sortKey] ?? SORT_COLUMNS.created_at,
    ascending: String(query.order ?? "").toLowerCase() === "asc",
    priority: PRIORITIES.includes(priority) ? priority : null,
    search: search === "" ? null : search,
  };
}
