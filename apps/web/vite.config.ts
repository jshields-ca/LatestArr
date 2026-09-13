import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const API_PATHS = [
  "/auth",
  "/sources",
  "/recipients",
  "/recipient-groups",
  "/smtp-profiles",
  "/newsletters",
  "/health",
];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
    },
  },
  server: {
    // apps/server has no /api prefix, so proxy each known API path
    // individually rather than everything — the SPA's own client-side
    // routes (e.g. "/sources" as a page) share the same origin in dev.
    proxy: Object.fromEntries(
      API_PATHS.map((p) => [p, { target: "http://localhost:3000", changeOrigin: true }]),
    ),
  },
});
