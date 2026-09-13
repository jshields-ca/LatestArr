import cookie from "@fastify/cookie";
import { registerAdapter } from "@latestarr/adapter-core";
import { tautulliAdapter } from "@latestarr/adapter-tautulli";
import type { Db } from "@latestarr/db";
import Fastify, { type FastifyInstance } from "fastify";
import { registerAuthRoutes } from "./http/routes/auth.js";
import { registerNewsletterRoutes } from "./http/routes/newsletters.js";
import { registerOidcRoutes } from "./http/routes/oidc.js";
import { registerRecipientGroupRoutes } from "./http/routes/recipient-groups.js";
import { registerRecipientRoutes } from "./http/routes/recipients.js";
import { registerSmtpProfileRoutes } from "./http/routes/smtp-profiles.js";
import { registerSourceRoutes } from "./http/routes/sources.js";
import type { SchedulerHandle } from "./scheduler/engine.js";

registerAdapter(tautulliAdapter);

// scheduler is optional and undefined in every test: starting real cron
// timers on every buildApp() call (many per test file) would be both slow
// and liable to fire mid-suite. Only apps/server/src/index.ts (the actual
// server entrypoint) constructs one via startScheduler() and passes it in.
export async function buildApp(db: Db, scheduler?: SchedulerHandle): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cookie);

  app.get("/health", async () => ({ status: "ok" }));

  registerAuthRoutes(app, db);
  registerOidcRoutes(app, db);
  registerSourceRoutes(app, db);
  registerSmtpProfileRoutes(app, db);
  registerRecipientRoutes(app, db);
  registerRecipientGroupRoutes(app, db);
  registerNewsletterRoutes(app, db, scheduler);

  return app;
}
