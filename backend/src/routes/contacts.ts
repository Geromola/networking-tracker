// routes/contacts.ts — the contact CRUD surface.
//
// Every handler runs behind requireUser, and every query goes out with the
// caller's JWT. Note that no handler ever mentions user_id: ownership is set by
// the column default on insert and enforced by RLS on read, update, and delete.

import { Router } from "express";

import { dataApiFor, mapDataApiError, type ContactRow } from "../data.ts";
import {
  parseContact,
  parseContactPatch,
  parseListQuery,
} from "../validation.ts";

export const contactsRouter = Router();

// The columns we hand back. Selecting explicitly (rather than "*") keeps the
// response stable if the table gains an internal column later.
const COLUMNS =
  "id,name,company,role,where_met,notes,priority,created_at,updated_at";

/** GET /api/contacts — sort and filter happen in Postgres, not the browser. */
contactsRouter.get("/", async (req, res) => {
  const { sort, ascending, priority, search } = parseListQuery(
    req.query as Record<string, unknown>,
  );

  let query = dataApiFor(req.userToken!)
    .from("contacts")
    .select(COLUMNS)
    .order(sort, { ascending });

  if (priority) query = query.eq("priority", priority);
  if (search) {
    // Escape PostgREST's wildcards so a literal % or _ is searched for, and
    // commas so the value cannot break out of the or() filter list.
    const safe = search.replace(/[%_,()]/g, (c) => `\\${c}`);
    query = query.or(`name.ilike.*${safe}*,company.ilike.*${safe}*`);
  }

  const { data, error } = await query;
  if (error) {
    const mapped = mapDataApiError(error);
    return res.status(mapped.status).json({ error: { message: mapped.message } });
  }

  res.json({ contacts: (data ?? []) as ContactRow[] });
});

/** POST /api/contacts */
contactsRouter.post("/", async (req, res) => {
  const parsed = parseContact(req.body);
  if (!parsed.ok) {
    return res
      .status(400)
      .json({ error: { message: parsed.message, fields: parsed.fields } });
  }

  // parsed.value carries no user_id: the database fills it from the JWT.
  const { data, error } = await dataApiFor(req.userToken!)
    .from("contacts")
    .insert(parsed.value)
    .select(COLUMNS);

  if (error) {
    const mapped = mapDataApiError(error);
    return res.status(mapped.status).json({ error: { message: mapped.message } });
  }

  res.status(201).json({ contact: (data ?? [])[0] as ContactRow });
});

/** PATCH /api/contacts/:id */
contactsRouter.patch("/:id", async (req, res) => {
  const parsed = parseContactPatch(req.body);
  if (!parsed.ok) {
    return res
      .status(400)
      .json({ error: { message: parsed.message, fields: parsed.fields } });
  }

  const { data, error } = await dataApiFor(req.userToken!)
    .from("contacts")
    .update(parsed.value)
    .eq("id", req.params.id)
    .select(COLUMNS);

  if (error) {
    const mapped = mapDataApiError(error);
    return res.status(mapped.status).json({ error: { message: mapped.message } });
  }

  // Zero rows means the id does not exist *or* it belongs to someone else.
  // Both answer the same way on purpose: telling the caller a row exists but
  // is not theirs would leak the existence of other users' data.
  if (!data?.length) {
    return res.status(404).json({ error: { message: "That contact was not found." } });
  }

  res.json({ contact: data[0] as ContactRow });
});

/** DELETE /api/contacts/:id */
contactsRouter.delete("/:id", async (req, res) => {
  const { data, error } = await dataApiFor(req.userToken!)
    .from("contacts")
    .delete()
    .eq("id", req.params.id)
    .select("id");

  if (error) {
    const mapped = mapDataApiError(error);
    return res.status(mapped.status).json({ error: { message: mapped.message } });
  }

  if (!data?.length) {
    return res.status(404).json({ error: { message: "That contact was not found." } });
  }

  res.status(204).end();
});
