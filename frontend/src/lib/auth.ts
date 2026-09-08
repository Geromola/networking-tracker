// lib/auth.ts — the browser's only direct connection to Neon.
//
// This talks to Managed Better Auth to sign in, sign out, and fetch a JWT.
// It never talks to the Data API: contact data goes through this project's own
// backend, which is what makes server-side validation meaningful.

import { createAuthClient } from "@neondatabase/neon-js/auth";

const authUrl = import.meta.env.VITE_NEON_AUTH_URL;

if (!authUrl) {
  throw new Error(
    "VITE_NEON_AUTH_URL is not set. Copy .env.example to .env.local and fill it in.",
  );
}

export const authClient = createAuthClient(authUrl);

/**
 * Fetch a JWT for the current session, to send to our backend as a bearer token.
 *
 * Neon's auth service exposes the better-auth `jwt` plugin, whose GET /token
 * endpoint mints a signed JWT. That is a different thing from the token on the
 * session object: the session token is an opaque identifier, and it would not
 * survive signature verification against JWKS.
 *
 * This is a plain fetch rather than an SDK call because the SDK in this version
 * exposes no dedicated token method, and `credentials: "include"` is what sends
 * the auth cookie to the Neon domain from our own origin.
 */
export async function getAccessToken(): Promise<string> {
  const response = await fetch(`${authUrl}/token`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `Could not get an access token (${response.status} from ${authUrl}/token)`,
    );
  }

  const body = (await response.json()) as { token?: string };
  if (!body?.token) {
    throw new Error("The auth service returned no token.");
  }
  return body.token;
}
