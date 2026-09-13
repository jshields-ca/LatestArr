import cookie from "@fastify/cookie";
import { registerAdapter } from "@latestarr/adapter-core";
import { tautulliAdapter } from "@latestarr/adapter-tautulli";
import type { Db } from "@latestarr/db";
import Fastify, { type FastifyInstance } from "fastify";
import { registerAuthRoutes } from "./http/routes/auth.js";
import { registerOidcRoutes } from "./http/routes/oidc.js";
import { registerSmtpProfileRoutes } from "./http/routes/smtp-profiles.js";
import { registerSourceRoutes } from "./http/routes/sources.js";

registerAdapter(tautulliAdapter);

export async function buildApp(db: Db): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cookie);

  app.get("/health", async () => ({ status: "ok" }));

  registerAuthRoutes(app, db);
  registerOidcRoutes(app, db);
  registerSourceRoutes(app, db);
  registerSmtpProfileRoutes(app, db);

  return app;
}
