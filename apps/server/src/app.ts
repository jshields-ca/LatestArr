import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { audiobookshelfAdapter } from "@latestarr/adapter-audiobookshelf";
import { bookOrbitAdapter, bookloreAdapter, grimmoryAdapter } from "@latestarr/adapter-booklore-family";
import { registerAdapter } from "@latestarr/adapter-core";
import { embyAdapter, jellyfinAdapter } from "@latestarr/adapter-jellyfin";
import { plexAdapter } from "@latestarr/adapter-plex";
import { rommAdapter } from "@latestarr/adapter-romm";
import { tautulliAdapter } from "@latestarr/adapter-tautulli";
import type { Db } from "@latestarr/db";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import { loadOidcConfigFromEnv } from "./auth/oidc-config.js";
import { requireSameOrigin } from "./http/require-same-origin.js";
import { registerAuthRoutes } from "./http/routes/auth.js";
import { type BackupRouteOptions, registerBackupRoutes } from "./http/routes/backups.js";
import { registerLogRoutes } from "./http/routes/logs.js";
import { registerNewsletterRoutes } from "./http/routes/newsletters.js";
import { registerNotificationRoutes } from "./http/routes/notifications.js";
import { registerOidcRoutes } from "./http/routes/oidc.js";
import { registerRecipientGroupRoutes } from "./http/routes/recipient-groups.js";
import { registerRecipientRoutes } from "./http/routes/recipients.js";
import { registerSmtpProfileRoutes } from "./http/routes/smtp-profiles.js";
import { registerSourceRoutes } from "./http/routes/sources.js";
import { registerSystemMailRoutes } from "./http/routes/system-mail.js";
import { registerTemplateRoutes } from "./http/routes/templates.js";
import { registerUserRoutes } from "./http/routes/users.js";
import { logger } from "./logger.js";
import type { SchedulerHandle } from "./scheduler/engine.js";

// Read once at module load rather than per-request — the version can't
// change without a restart anyway. `pnpm deploy` (used by the Docker
// build) copies this package's own package.json alongside dist/, and in
// dev (tsx running straight from src/) the same relative path resolves to
// the identical file one level up from src/ — so this works unmodified in
// both environments without needing to bundle package.json specially.
const packageJsonPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");
export const appVersion = (JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version: string }).version;

registerAdapter(tautulliAdapter);
registerAdapter(plexAdapter);
registerAdapter(jellyfinAdapter);
registerAdapter(embyAdapter);
registerAdapter(bookloreAdapter);
registerAdapter(bookOrbitAdapter);
registerAdapter(grimmoryAdapter);
registerAdapter(audiobookshelfAdapter);
registerAdapter(rommAdapter);

export interface BuildAppOptions {
  // Directory containing the built admin WebUI (apps/web's `dist`), served
  // as static assets with an index.html fallback for client-side routes.
  // Undefined/nonexistent in every test and in local dev (where Vite serves
  // the frontend separately on its own port) — only apps/server/src/index.ts
  // passes a real path, and only once it's built into the Docker image.
  staticRoot?: string;
  // The database's backup folder and schedule. Tests that don't exercise
  // backups leave it out, and the backup routes then answer 503.
  backups?: BackupRouteOptions;
}

// scheduler is optional and undefined in every test: starting real cron
// timers on every buildApp() call (many per test file) would be both slow
// and liable to fire mid-suite. Only apps/server/src/index.ts (the actual
// server entrypoint) constructs one via startScheduler() and passes it in.
export async function buildApp(
  db: Db,
  scheduler?: SchedulerHandle,
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  // Only trust X-Forwarded-* when explicitly told to — this process never
  // terminates TLS itself, so trusting those headers unconditionally would
  // let anyone with direct network access (the default, undocumented-proxy
  // deployment) spoof their IP (rate-limit bypass) or protocol. Reverse
  // proxy setups opt in via TRUST_PROXY=true (see docs/self-hosting.md);
  // this is also what makes the session cookie's Secure flag correct in
  // both modes (see auth.ts/oidc.ts, which key off request.protocol).
  // The shared logger (see logger.ts) writes to both stdout — what
  // `docker logs` shows — and the in-memory buffer behind GET /logs.
  // `as unknown as FastifyInstance`: passing a concrete pino instance via
  // loggerInstance makes Fastify() infer its return type parameterized
  // over that exact pino Logger<...> type, which structurally isn't
  // assignable to/from buildApp's own declared return type
  // (FastifyInstance, using Fastify's own FastifyBaseLogger interface) —
  // a known friction point of TypeScript + a custom pino logger instance,
  // not a real runtime mismatch (this is still a completely ordinary
  // Fastify instance).
  const app = Fastify({
    loggerInstance: logger,
    trustProxy: process.env.TRUST_PROXY === "true",
  }) as unknown as FastifyInstance;

  await app.register(cookie);

  // A client error (a bad body, too many requests) says what was wrong; a
  // server error is logged in full but answers with a generic message, so
  // internal details (SQL, file paths, stack frames) never reach the client.
  app.setErrorHandler((err: FastifyError, request, reply) => {
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
    if (status >= 500) {
      request.log.error({ err }, `${request.method} ${request.url} failed`);
      return reply.code(status).send({ error: "Something went wrong on the server. The Logs page has the details." });
    }
    return reply.code(status).send({ error: err.message });
  });

  // CSP allows what the admin WebUI actually needs: 'unsafe-inline' on
  // style-src for Radix's inline positioning styles and the design code
  // editor (CodeMirror adds its theme as <style> tags at runtime).
  // crossOriginEmbedderPolicy is off because it would otherwise block the
  // Google Fonts stylesheet (no CORP header) used for the "LatestArr"
  // wordmark.
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        // helmet's defaults silently include this even though we override
        // every other default directive above — it tells the browser to
        // rewrite every http:// subresource request (scripts, styles, the
        // favicon, ...) on the page to https:// before sending it, per the
        // CSP spec, independent of any browser "HTTPS-Only Mode" setting.
        // LatestArr has no TLS listener of its own (TLS is a reverse
        // proxy's job per docs/self-hosting.md), so for anyone running it
        // over plain HTTP directly, those upgraded requests fail outright
        // and the app never loads. `null` removes the directive instead of
        // just omitting it, since omitting it still leaves the default in
        // place (see helmet's `useDefaults`).
        upgradeInsecureRequests: null,
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  // Generous global default (this is a low-traffic admin tool, not a
  // public API, so the limit exists to blunt abuse/bugs, not to throttle
  // normal use); auth routes get a much stricter per-route override below
  // since they're the realistic brute-force target.
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });

  // Same-origin check on every mutating request (see require-same-origin.ts
  // for why this is the CSRF defense here instead of a token).
  app.addHook("preHandler", requireSameOrigin());

  app.get("/health", async () => ({ status: "ok" }));

  // Every actual API route lives under /api — the admin WebUI is served
  // from "/" in production (see the static-serving block below), and
  // several resources share a name with a client-side route (e.g.
  // "/sources" the page vs. "/sources" the endpoint). Without this split,
  // reloading such a page in production would hit the API route instead
  // of the SPA. Fastify's route prefix composes through nested
  // app.register() calls, so none of the individual route files need to
  // know about the prefix.
  await app.register(
    async (api) => {
      // Unauthenticated (like /health) — the WebUI shows this in its
      // sidebar so a self-hoster can tell what version they're running
      // at a glance without checking the container image tag.
      api.get("/version", async () => ({ version: appVersion }));

      registerAuthRoutes(api, db, { oidcEnabled: loadOidcConfigFromEnv() !== null });
      registerOidcRoutes(api, db);
      registerSourceRoutes(api, db);
      registerSmtpProfileRoutes(api, db);
      registerRecipientRoutes(api, db);
      registerRecipientGroupRoutes(api, db);
      registerNewsletterRoutes(api, db, scheduler);
      registerTemplateRoutes(api, db);
      registerUserRoutes(api, db);
      registerLogRoutes(api, db);
      registerNotificationRoutes(api, db);
      registerSystemMailRoutes(api, db);
      registerBackupRoutes(api, db, options.backups ?? {});
    },
    { prefix: "/api" },
  );

  if (options.staticRoot && existsSync(options.staticRoot)) {
    await app.register(fastifyStatic, {
      root: options.staticRoot,
      // Lets the plugin serve index.html for "/" itself. With index:
      // false, a directory request like "/" falls into @fastify/send's
      // "directory listing forbidden" path (a 403), not the ENOENT path
      // that triggers reply.callNotFound() — so it would never reach the
      // SPA-fallback handler below. Every *other* unmatched client-side
      // route (e.g. /sources) isn't a directory on disk, so those still
      // ENOENT through to the not-found handler as intended.
      index: ["index.html"],
    });

    const indexHtml = readFileSync(path.join(options.staticRoot, "index.html"), "utf8");

    app.setNotFoundHandler((request, reply) => {
      // Only GET navigations fall back to the SPA shell; a bad API call
      // (wrong method, or a path that isn't a real route) still gets a
      // normal JSON 404 rather than an HTML page.
      if (request.method !== "GET") {
        return reply.code(404).send({ error: "Not found" });
      }
      return reply.type("text/html").send(indexHtml);
    });
  }

  return app;
}
