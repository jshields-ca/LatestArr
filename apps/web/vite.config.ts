import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
    },
  },
  server: {
    // apps/server and apps/web run as separate dev servers, so proxy the
    // backend's /api namespace through to it. Every backend route lives
    // under /api specifically so it can never collide with an SPA
    // client-side route of the same name (e.g. "/sources" the page vs.
    // "/sources" the endpoint) — see apps/server/src/app.ts.
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
