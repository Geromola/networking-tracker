import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: {
    port: 5173,
    // In development the API runs as its own process on :3001. Proxying it
    // under the same origin as the app mirrors how Vercel serves both in
    // production, so there is no CORS configuration in either environment.
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
    },
  },
});
