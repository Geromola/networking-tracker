// rls.test.ts — proof that one user cannot reach another user's contacts.
//
// This is the two-account privacy test, written as code rather than as a pair
// of screenshots, so anyone can re-run it. It deliberately talks to the Neon
// Data API *directly*, bypassing this project's own backend: if it passes,
// ownership is enforced by Postgres itself, not by API code that a future
// change might weaken.
//
// It needs live credentials, so it skips when they are absent. That keeps
// `npm test` green on a fresh clone while still giving the real check to
// anyone who fills in .env.local. Run it with:
//
//   node --env-file=.env.local --test backend/src/rls.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import { createClient } from "@neondatabase/neon-js";

const {
  NEON_AUTH_URL,
  NEON_DATA_API_URL,
  TEST_USER_A_EMAIL,
  TEST_USER_A_PASSWORD,
  TEST_USER_B_EMAIL,
  TEST_USER_B_PASSWORD,
} = process.env;

const configured = Boolean(
  NEON_AUTH_URL &&
    NEON_DATA_API_URL &&
    TEST_USER_A_EMAIL &&
    TEST_USER_A_PASSWORD &&
    TEST_USER_B_EMAIL &&
    TEST_USER_B_PASSWORD,
);

const authBase = (NEON_AUTH_URL ?? "").replace(/\/+$/, "");

/**
 * Neon Auth rejects requests with no Origin header (MISSING_OR_NULL_ORIGIN),
 * and validates the one it gets against the project's trusted origins. Node's
 * fetch sends none, because a server has no origin — so the test states one
 * explicitly, standing in for the browser it is simulating.
 */
const ORIGIN = process.env.TEST_ORIGIN ?? "http://localhost:5173";

/**
 * Sign in over plain HTTP and exchange the session for a JWT.
 *
 * Done by hand rather than through the SDK because the SDK expects a browser's
 * cookie jar. Doing it this way also makes the two-step flow visible: the
 * session cookie proves who you are, and GET /token mints the signed JWT that
 * the Data API will actually verify against Neon's public keys.
 */
async function signIn(email: string, password: string): Promise<string> {
  const signInResponse = await fetch(`${authBase}/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ email, password }),
  });

  assert.ok(
    signInResponse.ok,
    `sign-in failed for ${email}: ${signInResponse.status} ${await signInResponse.text()}`,
  );

  const cookie = (signInResponse.headers.getSetCookie?.() ?? [])
    .map((entry) => entry.split(";")[0])
    .join("; ");

  const tokenResponse = await fetch(`${authBase}/token`, {
    headers: { cookie, Origin: ORIGIN },
  });
  assert.ok(tokenResponse.ok, `token request failed for ${email}: ${tokenResponse.status}`);

  const { token } = (await tokenResponse.json()) as { token?: string };
  assert.ok(token, `no JWT returned for ${email}`);
  return token;
}

const clientFor = (token: string | null) =>
  createClient({
    dataApi: {
      url: NEON_DATA_API_URL!,
      getToken: async () => token,
    },
  });

test(
  "row level security keeps one user's contacts away from another",
  { skip: configured ? false : "set the TEST_USER_* variables in .env.local to run this" },
  async (t) => {
    const [tokenA, tokenB] = await Promise.all([
      signIn(TEST_USER_A_EMAIL!, TEST_USER_A_PASSWORD!),
      signIn(TEST_USER_B_EMAIL!, TEST_USER_B_PASSWORD!),
    ]);

    const userA = clientFor(tokenA);
    const userB = clientFor(tokenB);
    const marker = `RLS probe ${Date.now()}`;
    let contactId = "";

    t.after(async () => {
      // Clean up as A, the only user allowed to delete it.
      if (contactId) await userA.from("contacts").delete().eq("id", contactId);
    });

    await t.test("A can create a contact, and the database assigns the owner", async () => {
      // Note that no user_id is sent: it comes from the JWT via the column default.
      const { data, error } = await userA
        .from("contacts")
        .insert({ name: marker, priority: "high" })
        .select("id,user_id,name");

      assert.equal(error, null, `insert failed: ${JSON.stringify(error)}`);
      assert.equal(data?.length, 1);
      assert.ok(data![0].user_id, "the database should have stamped an owner");
      contactId = data![0].id;
    });

    await t.test("A can read it back", async () => {
      const { data } = await userA.from("contacts").select("id").eq("id", contactId);
      assert.equal(data?.length, 1);
    });

    await t.test("B does not see it in a full listing", async () => {
      const { data, error } = await userB.from("contacts").select("id,name");
      assert.equal(error, null);
      assert.ok(
        !data?.some((row: { id: string }) => row.id === contactId),
        "user B must not see user A's contact in a list",
      );
    });

    await t.test("B cannot fetch it even knowing its exact id", async () => {
      const { data } = await userB.from("contacts").select("id").eq("id", contactId);
      assert.equal(data?.length, 0, "the SELECT policy should hide the row entirely");
    });

    await t.test("B cannot edit it", async () => {
      const { data } = await userB
        .from("contacts")
        .update({ name: "hijacked by B" })
        .eq("id", contactId)
        .select("id");
      assert.equal(data?.length, 0, "the UPDATE policy should match no rows");

      // And A's copy is untouched.
      const { data: after } = await userA
        .from("contacts")
        .select("name")
        .eq("id", contactId);
      assert.equal(after?.[0]?.name, marker);
    });

    await t.test("B cannot steal it by rewriting user_id", async () => {
      // This is what the UPDATE policy's WITH CHECK clause exists to stop.
      const { data } = await userB
        .from("contacts")
        .update({ user_id: "some-other-user" })
        .eq("id", contactId)
        .select("id");
      assert.equal(data?.length, 0);
    });

    await t.test("B cannot delete it", async () => {
      const { data } = await userB
        .from("contacts")
        .delete()
        .eq("id", contactId)
        .select("id");
      assert.equal(data?.length, 0, "the DELETE policy should match no rows");

      const { data: still } = await userA
        .from("contacts")
        .select("id")
        .eq("id", contactId);
      assert.equal(still?.length, 1, "A's contact should have survived B's delete");
    });

    await t.test("an unauthenticated request reads nothing at all", async () => {
      // No JWT means the anonymous role, which has no grant on this table.
      const { data } = await clientFor(null).from("contacts").select("id");
      assert.ok(!data?.length, "anonymous access must return no rows");
    });
  },
);
