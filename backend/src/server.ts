// server.ts — local development entry point only.
// In production the same app is exported as a serverless function instead.

import { app } from "./app.ts";

const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
