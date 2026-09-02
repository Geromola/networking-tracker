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
 * endpoint mints a signed JWT. This is a different thing from the session
 * token on the session object: that one is an opaque session identifier and
 * would not survive signature verification against JWKS.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const result = await authClient.$fetch<{ token?: string }>("/token", {
      method: "GET",
    });
    const data = (result as { data?: { token?: string } }).data ?? result;
    return (data as { token?: string })?.token ?? null;
  } catch {
    return null;
  }
}
