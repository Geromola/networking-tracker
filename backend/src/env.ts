// env.ts — read and check server-only configuration in one place.
//
// None of these values are ever sent to the browser. The frontend gets exactly
// one public value (the Auth URL, baked in at build time by Vite); everything
// here stays on the server.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value.replace(/\/+$/, "");
}

export const NEON_AUTH_URL = () => required("NEON_AUTH_URL");
export const NEON_DATA_API_URL = () => required("NEON_DATA_API_URL");

/**
 * Where to fetch the public keys that prove a JWT came from Neon Auth.
 * Overridable because the path has moved between Neon releases; the default
 * is the one Neon's own backend guide documents.
 */
export const JWKS_URL = () =>
  process.env.NEON_AUTH_JWKS_URL?.replace(/\/+$/, "") ??
  `${NEON_AUTH_URL()}/.well-known/jwks.json`;

/**
 * Issuers we accept on a token. Neon has published the auth base URL both with
 * and without its database path, so both spellings are allowed — the signature
 * check against JWKS is what actually establishes trust.
 */
export const ALLOWED_ISSUERS = (): string[] => {
  const url = NEON_AUTH_URL();
  return [url, new URL(url).origin];
};
