import cookie from "@fastify/cookie";
import type { Db } from "@latestarr/db";
import Fastify, { type FastifyInstance } from "fastify";
import { registerAuthRoutes } from "./http/routes/auth.js";

export async function buildApp(db: Db): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cookie);

  app.get("/health", async () => ({ status: "ok" }));

  registerAuthRoutes(app, db);

  return app;
}
