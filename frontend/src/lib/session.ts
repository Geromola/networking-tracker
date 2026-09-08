// lib/session.ts — one hook that owns "who is signed in".

import { useCallback, useEffect, useState } from "react";

import { authClient } from "./auth.ts";

export type SessionUser = { id: string; email: string; name?: string };

type State =
  | { status: "loading"; user: null }
  | { status: "signedIn"; user: SessionUser }
  | { status: "signedOut"; user: null };

/**
 * How long to wait for the session lookup before treating the user as signed
 * out. An unknown session is not a reason to leave someone staring at a
 * spinner: the worst case of guessing "signed out" is that they see the sign-in
 * form, which is exactly where an unauthenticated person should end up.
 */
const SESSION_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`session lookup timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export function useSession() {
  // Starting in "loading" is what stops the app flashing the sign-in screen at
  // somebody who is already signed in while the session lookup is in flight.
  const [state, setState] = useState<State>({ status: "loading", user: null });

  const refresh = useCallback(async () => {
    try {
      const result = await withTimeout(authClient.getSession(), SESSION_TIMEOUT_MS);
      const user = result?.data?.user as SessionUser | undefined;
      setState(user ? { status: "signedIn", user } : { status: "signedOut", user: null });
    } catch (err) {
      // Log rather than swallow: a session lookup that fails silently is how a
      // permanent "Loading…" screen hides a real problem.
      console.warn("Session lookup failed; treating as signed out.", err);
      setState({ status: "signedOut", user: null });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await authClient.signOut();
    } finally {
      // Sign out locally even if the network call fails, so the button always
      // does what it says.
      setState({ status: "signedOut", user: null });
    }
  }, []);

  return { ...state, refresh, signOut };
}
