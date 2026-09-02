// app.ts — the Express application, with no listener attached.
//
// Keeping .listen() out of this file is what lets the same app run two ways:
// as a long-lived process locally (server.ts) and as a Vercel serverless
// function in production (../../api/index.ts).

import express from "express";

import { requireUser } from "./auth.ts";
import { contactsRouter } from "./routes/contacts.ts";

export const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));

/** Liveness check. Deliberately reveals no configuration values. */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Everything below this line requires a verified Neon Auth JWT.
app.use("/api/contacts", requireUser, contactsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: { message: "Not found." } });
});

// Final safety net. An unexpected throw becomes a generic 500: internal
// messages and stack traces stay in the logs, not in the HTTP response.
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Unhandled error:", err);
    if (res.headersSent) return;
    res
      .status(500)
      .json({ error: { message: "Something went wrong. Please try again." } });
  },
);

export default app;
