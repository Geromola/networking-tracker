import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Field } from "@/components/ui/field.tsx";
import { Input } from "@/components/ui/input.tsx";
import { authClient } from "@/lib/auth.ts";
import { cn } from "@/lib/utils.ts";

type Mode = "signIn" | "signUp";

/** Pull a readable sentence out of whatever shape the auth client threw. */
function messageFor(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: string }).message;
    if (message) return message;
  }
  return fallback;
}

export function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<Mode>("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    // Check before calling out, so an obvious mistake gets an instant answer.
    if (mode === "signUp" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    try {
      const result =
        mode === "signUp"
          ? await authClient.signUp.email({ name: name.trim() || email, email, password })
          : await authClient.signIn.email({ email, password });

      if ((result as { error?: unknown })?.error) {
        throw (result as { error: unknown }).error;
      }

      toast.success(mode === "signUp" ? "Account created." : "Signed in.");
      onSignedIn();
    } catch (err) {
      setError(
        messageFor(
          err,
          mode === "signUp"
            ? "Could not create that account."
            : "That email and password did not match.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Networking Tracker</h1>
      <p className="mt-2 text-sm text-fg-muted">
        Keep track of the people you want to stay connected with at Berkeley.
      </p>

      <Card className="mt-6 p-6">
        <div role="tablist" className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(["signIn", "signUp"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => {
                setMode(value);
                setError("");
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                mode === value ? "bg-surface shadow-sm" : "text-fg-muted hover:text-fg",
              )}
            >
              {value === "signIn" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {mode === "signUp" && (
            <Field id="name" label="Name">
              <Input
                id="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
              />
            </Field>
          )}

          <Field id="email" label="Email">
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@berkeley.edu"
            />
          </Field>

          <Field
            id="password"
            label="Password"
            hint={mode === "signUp" ? "At least 8 characters." : undefined}
          >
            <Input
              id="password"
              type="password"
              required
              autoComplete={mode === "signUp" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          {error && (
            <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Working…" : mode === "signUp" ? "Create account" : "Sign in"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
