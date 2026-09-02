// api/index.ts — Vercel serverless function entry.
//
// Vercel treats every file in /api as a function. This one just re-exports the
// Express app; Vercel's Node runtime accepts an Express handler directly.
//
// The import is relative rather than by workspace name because Vercel's
// bundler follows relative paths reliably, while workspace resolution inside a
// function bundle is a common source of build failures.

export { default } from "../backend/src/app.ts";
