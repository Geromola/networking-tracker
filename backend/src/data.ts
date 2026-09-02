// data.ts — talk to the Neon Data API as the signed-in user.
//
// The important detail: this server has no privileged database credential. It
// holds no DATABASE_URL and no service-role key. Every query is made with the
// caller's own JWT, so Postgres evaluates the RLS policies as that user. If a
// bug in a route forgot to filter by owner, RLS would still return nothing —
// the security boundary is in the database, not in this code.

import { createClient } from "@neondatabase/neon-js";

import { NEON_DATA_API_URL } from "./env.ts";

/**
 * A Data API client scoped to one request's user.
 *
 * `getToken` is consulted lazily on every request the client makes, which is
 * why a fresh client per HTTP request is the right granularity: there is no
 * shared, ambiently-authenticated client that could leak across users.
 */
export function dataApiFor(token: string) {
  return createClient({
    dataApi: {
      url: NEON_DATA_API_URL(),
      getToken: async () => token,
    },
  });
}

/** The row shape the Data API returns for a contact. */
export type ContactRow = {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  role: string | null;
  where_met: string | null;
  notes: string | null;
  priority: "high" | "medium" | "low";
  created_at: string;
  updated_at: string;
};

type PostgrestError = { code?: string; message?: string; details?: string };

/**
 * Translate a Postgres/PostgREST failure into an HTTP status and a sentence a
 * person can act on. Constraint violations are the user's fault (400), not
 * ours (500) — a CHECK that fires here means validation was bypassed, and it
 * should still fail safely rather than surfacing a stack trace.
 */
export function mapDataApiError(error: PostgrestError): {
  status: number;
  message: string;
} {
  switch (error.code) {
    case "23514": // check_violation
      if (error.message?.includes("priority")) {
        return { status: 400, message: "Priority must be high, medium, or low." };
      }
      if (error.message?.includes("name")) {
        return { status: 400, message: "Name is required." };
      }
      return { status: 400, message: "That contact is not valid." };
    case "23502": // not_null_violation
      return { status: 400, message: "A required field was missing." };
    case "42501": // insufficient_privilege — an RLS policy refused the write
      return { status: 403, message: "You can only change your own contacts." };
    case "22P02": // invalid_text_representation, e.g. a malformed uuid
      return { status: 400, message: "That contact id is not valid." };
    default:
      return { status: 500, message: "Something went wrong. Please try again." };
  }
}
