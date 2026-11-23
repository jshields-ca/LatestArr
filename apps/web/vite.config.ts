import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Never inline fonts (#469). Vite inlines files under 4 KB as data: URIs,
 * which caught two tiny font subsets, and the server's Content Security
 * Policy allows fonts only from the app itself (and Google, for the email
 * preview). Other small files inline as usual.
 */
export function assetsInlineLimit(filePath: string): boolean | undefined {
  return /\.(woff2?|ttf|otf|eot)$/i.test(filePath) ? false : undefined;
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { assetsInlineLimit },
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
      // changeOrigin rewrites the outgoing Host header to match the target,
      // but leaves Origin as the browser's real (5173) value — which trips
      // the server's same-origin CSRF check (requireSameOrigin in
      // apps/server/src/http/require-same-origin.ts compares Origin's host
      // against Host) on every mutating request in local dev. Rewriting
      // Origin here too keeps that check meaningful in production (where
      // web and API really do share an origin) while not requiring a dev
      // special-case on the server itself.
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("origin", "http://localhost:3000");
          });
        },
      },
    },
  },
});
