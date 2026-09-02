// auth.ts — turn an incoming Authorization header into a trusted user id.
//
// The browser sends the JWT it got from Neon Auth. We never take that token at
// face value: its signature is checked against Neon's published public keys
// (JWKS), so a hand-crafted or edited token is rejected here, before any route
// runs and before anything touches the database.

import type { NextFunction, Request, Response } from "express";
import * as jose from "jose";

import { ALLOWED_ISSUERS, JWKS_URL } from "./env.ts";

declare global {
  namespace Express {
    interface Request {
      /** The verified `sub` claim. Set only by requireUser. */
      userId?: string;
      /** The raw JWT, forwarded to the Data API so RLS runs as this user. */
      userToken?: string;
    }
  }
}

// Built once per process and cached: jose fetches the key set lazily and
// re-fetches only when it sees an unknown key id.
let jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;
function keyStore() {
  if (!jwks) jwks = jose.createRemoteJWKSet(new URL(JWKS_URL()));
  return jwks;
}

export class AuthError extends Error {
  status = 401;
}

function bearerToken(req: Request): string | null {
  const header = req.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (!token || scheme?.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

/**
 * Express middleware. Rejects the request unless it carries a JWT that Neon
 * actually signed, then records the user id and the raw token on the request.
 */
export async function requireUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = bearerToken(req);
  if (!token) {
    return res
      .status(401)
      .json({ error: { message: "You need to be signed in to do that." } });
  }

  try {
    const { payload } = await jose.jwtVerify(token, keyStore());

    // jwtVerify has already proven the signature and checked expiry. The
    // issuer is compared here rather than passed as an option so that either
    // documented spelling of the Neon auth URL is accepted.
    if (payload.iss && !ALLOWED_ISSUERS().includes(payload.iss)) {
      throw new AuthError(`Unexpected token issuer ${payload.iss}`);
    }
    if (!payload.sub) {
      throw new AuthError("Token is missing a subject claim");
    }

    req.userId = payload.sub;
    req.userToken = token;
    next();
  } catch {
    // Deliberately vague to the client: distinguishing "expired" from
    // "bad signature" tells an attacker which knob to turn.
    res
      .status(401)
      .json({ error: { message: "Your session has expired. Please sign in again." } });
  }
}
