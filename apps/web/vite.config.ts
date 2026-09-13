import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Paths with no SPA route of the same name — always proxy, including full
// page navigations (this is required for /auth/oidc/login, which is meant
// to be hit via <a href>, not fetch).
const PLAIN_API_PATHS = ["/auth", "/recipient-groups", "/smtp-profiles", "/health"];

// Paths that collide with an SPA client-side route of the same name —
// proxy fetch/XHR calls, but let a real browser navigation or reload fall
// through to the SPA (see the `bypass` below).
const SPA_SHADOWED_API_PATHS = ["/sources", "/recipients", "/newsletters"];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
    },
  },
  server: {
    // apps/server has no /api prefix, so proxy each known API path
    // individually rather than everything.
    proxy: {
      ...Object.fromEntries(
        PLAIN_API_PATHS.map((p) => [p, { target: "http://localhost:3000", changeOrigin: true }]),
      ),
      ...Object.fromEntries(
        SPA_SHADOWED_API_PATHS.map((p) => [
          p,
          {
            target: "http://localhost:3000",
            changeOrigin: true,
            // Distinguishes an XHR/fetch call (proxy it) from a real
            // browser navigation/reload (serve index.html so the SPA
            // router handles it) by the Accept header — the pattern from
            // Vite's own proxy docs for exactly this SPA+API overlap.
            bypass(req: { headers: { accept?: string } }) {
              if (req.headers.accept?.includes("text/html")) {
                return "/index.html";
              }
            },
          },
        ]),
      ),
    },
  },
});
