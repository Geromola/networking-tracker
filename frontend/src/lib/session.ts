// lib/session.ts — one hook that owns "who is signed in".

import { useCallback, useEffect, useState } from "react";

import { authClient } from "./auth.ts";

export type SessionUser = { id: string; email: string; name?: string };

type State =
  | { status: "loading"; user: null }
  | { status: "signedIn"; user: SessionUser }
  | { status: "signedOut"; user: null };

export function useSession() {
  // Starting in "loading" is what stops the app flashing the sign-in screen at
  // somebody who is already signed in while getSession() is still in flight.
  const [state, setState] = useState<State>({ status: "loading", user: null });

  const refresh = useCallback(async () => {
    try {
      const result = await authClient.getSession();
      const user = result?.data?.user as SessionUser | undefined;
      setState(user ? { status: "signedIn", user } : { status: "signedOut", user: null });
    } catch {
      setState({ status: "signedOut", user: null });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    setState({ status: "signedOut", user: null });
  }, []);

  return { ...state, refresh, signOut };
}
