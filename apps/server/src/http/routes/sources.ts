import { getAdapter, listAdapterKinds } from "@latestarr/adapter-core";
import { decrypt, encrypt } from "@latestarr/crypto";
import { type Db, sourceConnections } from "@latestarr/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getEncryptionKey } from "../../secrets.js";
import { requireAuth } from "../require-auth.js";
import { parseBody } from "../validate.js";

type SelectedSourceConnection = typeof sourceConnections.$inferSelect;

function sanitize(row: SelectedSourceConnection) {
  const { credentialsEncrypted: _credentialsEncrypted, ...safe } = row;
  return safe;
}

function decryptCredentials(row: SelectedSourceConnection): Record<string, string> {
  return JSON.parse(
    decrypt(row.credentialsEncrypted, getEncryptionKey()),
  ) as Record<string, string>;
}

const createSourceSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  kind: z.string().trim().min(1, "kind is required"),
  baseUrl: z.url("baseUrl must be a valid URL"),
  credentials: z.record(z.string(), z.string()),
});

interface IdParams {
  id: string;
}

export function registerSourceRoutes(app: FastifyInstance, db: Db): void {
  // Registered as a plugin so the preHandler hook is scoped to these routes
  // only — adding it directly on `app` would apply it to every route on the
  // instance, including /auth/* and /health.
  void app.register(async (scope) => {
    scope.addHook("preHandler", requireAuth(db));

    scope.post("/sources", async (request, reply) => {
      const body = parseBody(createSourceSchema, request.body, reply);
      if (!body) return reply;
      const { name, kind, baseUrl, credentials } = body;

      if (!getAdapter(kind)) {
        return reply.code(400).send({ error: `Unknown source kind: ${kind}` });
      }

      const credentialsEncrypted = encrypt(JSON.stringify(credentials), getEncryptionKey());
      const [row] = await db
        .insert(sourceConnections)
        .values({ name, kind, baseUrl, credentialsEncrypted })
        .returning();

      return reply.code(201).send({ source: sanitize(row!) });
    });

    scope.get("/sources", async (_request, reply) => {
      const rows = await db.select().from(sourceConnections);
      return reply.send({ sources: rows.map(sanitize) });
    });

    // Static route, so it's matched ahead of the "/sources/:id" param route
    // below regardless of registration order.
    scope.get("/sources/kinds", async (_request, reply) => {
      return reply.send({ kinds: listAdapterKinds() });
    });

    scope.get<{ Params: IdParams }>("/sources/:id", async (request, reply) => {
      const [row] = await db
        .select()
        .from(sourceConnections)
        .where(eq(sourceConnections.id, request.params.id));
      if (!row) {
        return reply.code(404).send({ error: "Not found" });
      }
      return reply.send({ source: sanitize(row) });
    });

    scope.delete<{ Params: IdParams }>("/sources/:id", async (request, reply) => {
      await db.delete(sourceConnections).where(eq(sourceConnections.id, request.params.id));
      return reply.code(204).send();
    });

    scope.post<{ Params: IdParams }>("/sources/:id/test", async (request, reply) => {
      const [row] = await db
        .select()
        .from(sourceConnections)
        .where(eq(sourceConnections.id, request.params.id));
      if (!row) {
        return reply.code(404).send({ error: "Not found" });
      }

      const adapter = getAdapter(row.kind);
      if (!adapter) {
        return reply.code(400).send({ error: `Unknown source kind: ${row.kind}` });
      }

      const result = await adapter.testConnection({
        baseUrl: row.baseUrl,
        credentials: decryptCredentials(row),
      });

      await db
        .update(sourceConnections)
        .set({
          status: result.ok ? "ok" : "error",
          lastCheckedAt: new Date(),
          lastError: result.ok ? null : (result.message ?? "Unknown error"),
        })
        .where(eq(sourceConnections.id, row.id));

      return reply.send(result);
    });

    scope.get<{ Params: IdParams }>("/sources/:id/libraries", async (request, reply) => {
      const [row] = await db
        .select()
        .from(sourceConnections)
        .where(eq(sourceConnections.id, request.params.id));
      if (!row) {
        return reply.code(404).send({ error: "Not found" });
      }

      const adapter = getAdapter(row.kind);
      if (!adapter) {
        return reply.code(400).send({ error: `Unknown source kind: ${row.kind}` });
      }

      const libraries = await adapter.listLibraries({
        baseUrl: row.baseUrl,
        credentials: decryptCredentials(row),
      });

      return reply.send({ libraries });
    });
  });
}
