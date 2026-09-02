// validation.test.ts — run with:  npm test
//
// Node's built-in test runner, so there is no framework to install and no
// build step. Nothing here touches the network or the database, which means
// these tests pass on a fresh clone with no .env file and no Neon project.
//
// The two-user ownership proof lives in rls.test.ts, which needs credentials.

import test from "node:test";
import assert from "node:assert/strict";

import {
  parseContact,
  parseContactPatch,
  parseListQuery,
  SORT_COLUMNS,
} from "./validation.ts";

// --- names ----------------------------------------------------------------

test("a missing name is rejected", () => {
  const result = parseContact({ priority: "high" });
  assert.equal(result.ok, false);
  assert.equal(result.fields.name, "Name is required.");
});

test("an empty name is rejected", () => {
  const result = parseContact({ name: "" });
  assert.equal(result.ok, false);
  assert.equal(result.fields.name, "Name is required.");
});

test("a whitespace-only name is rejected", () => {
  // The database CHECK uses btrim for the same reason: "   " is not a name.
  const result = parseContact({ name: "   " });
  assert.equal(result.ok, false);
  assert.equal(result.fields.name, "Name is required.");
});

test("a name longer than 200 characters is rejected", () => {
  const result = parseContact({ name: "a".repeat(201) });
  assert.equal(result.ok, false);
  assert.match(result.fields.name, /200 characters/);
});

test("a valid name is trimmed and its inner whitespace collapsed", () => {
  const result = parseContact({ name: "  Ada   Lovelace " });
  assert.equal(result.ok, true);
  assert.equal(result.value.name, "Ada Lovelace");
});

// --- priority -------------------------------------------------------------

test("priority accepts exactly high, medium, and low", () => {
  for (const priority of ["high", "medium", "low"]) {
    const result = parseContact({ name: "Grace Hopper", priority });
    assert.equal(result.ok, true, `expected ${priority} to be accepted`);
    assert.equal(result.value.priority, priority);
  }
});

test("an invalid priority is rejected with a readable message", () => {
  const result = parseContact({ name: "Grace Hopper", priority: "urgent" });
  assert.equal(result.ok, false);
  assert.equal(result.fields.priority, "Priority must be high, medium, or low.");
});

test("priority defaults to medium when omitted", () => {
  const result = parseContact({ name: "Grace Hopper" });
  assert.equal(result.ok, true);
  assert.equal(result.value.priority, "medium");
});

// --- ownership ------------------------------------------------------------

test("a client-supplied user_id is stripped and never reaches the database", () => {
  // This is the ownership guarantee in code. Even if a caller hand-crafts a
  // request claiming to be someone else, the key does not survive validation.
  const result = parseContact({
    name: "Alan Turing",
    user_id: "some-other-users-id",
    id: "11111111-1111-1111-1111-111111111111",
  });
  assert.equal(result.ok, true);
  assert.ok(!("user_id" in result.value), "user_id must not survive validation");
  assert.ok(!("id" in result.value), "id must not survive validation");
});

// --- optional fields ------------------------------------------------------

test("blank optional fields become null rather than empty strings", () => {
  const result = parseContact({ name: "Katherine Johnson", company: "  ", notes: "" });
  assert.equal(result.ok, true);
  assert.equal(result.value.company, null);
  assert.equal(result.value.notes, null);
});

// --- patches --------------------------------------------------------------

test("a patch only carries the keys the client actually sent", () => {
  const result = parseContactPatch({ priority: "low" });
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.value), ["priority"]);
});

test("a patch that blanks the name is still rejected", () => {
  const result = parseContactPatch({ name: "  " });
  assert.equal(result.ok, false);
  assert.equal(result.fields.name, "Name is required.");
});

test("an empty patch is rejected instead of issuing a no-op write", () => {
  const result = parseContactPatch({});
  assert.equal(result.ok, false);
  assert.match(result.message, /No changes/);
});

// --- list query -----------------------------------------------------------

test("an unknown sort column falls back to the default instead of being injected", () => {
  const result = parseListQuery({ sort: "user_id; drop table contacts" });
  assert.equal(result.sort, SORT_COLUMNS.created_at);
});

test("sorting by priority uses the rank column, not the text column", () => {
  assert.equal(parseListQuery({ sort: "priority" }).sort, "priority_rank");
});

test("an unrecognized priority filter is dropped rather than applied", () => {
  assert.equal(parseListQuery({ priority: "urgent" }).priority, null);
  assert.equal(parseListQuery({ priority: "high" }).priority, "high");
});

test("search is trimmed, and blank search means no filter", () => {
  assert.equal(parseListQuery({ search: "  neon  " }).search, "neon");
  assert.equal(parseListQuery({ search: "   " }).search, null);
});
