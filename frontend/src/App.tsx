import { Toaster } from "sonner";

import { Contacts } from "@/pages/Contacts.tsx";
import { SignIn } from "@/pages/SignIn.tsx";
import { useSession } from "@/lib/session.ts";

export default function App() {
  const { status, user, refresh, signOut } = useSession();

  return (
    <>
      {/* "loading" is its own state so the app never flashes the sign-in
          screen at somebody who already has a valid session. */}
      {status === "loading" && (
        <div className="flex min-h-full items-center justify-center" aria-busy="true">
          <p className="text-sm text-fg-muted">Loading…</p>
        </div>
      )}
      {status === "signedOut" && <SignIn onSignedIn={refresh} />}
      {status === "signedIn" && <Contacts user={user} onSignOut={signOut} />}

      <Toaster position="top-center" richColors closeButton />
    </>
  );
}
