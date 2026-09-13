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
import { registerSourceRoutes } from "./http/routes/sources.js";

registerAdapter(tautulliAdapter);

export async function buildApp(db: Db): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cookie);

  app.get("/health", async () => ({ status: "ok" }));

  registerAuthRoutes(app, db);
  registerOidcRoutes(app, db);
  registerSourceRoutes(app, db);
  registerRecipientRoutes(app, db);
  registerRecipientGroupRoutes(app, db);
  registerNewsletterRoutes(app, db);

  return app;
}
