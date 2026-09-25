import { getAdapter, listAdapterKinds } from "@latestarr/adapter-core";
import { decrypt, encrypt } from "@latestarr/crypto";
import { type Db, sourceConnections } from "@latestarr/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getEncryptionKey } from "../../secrets.js";
import { changedFields } from "../log-fields.js";
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

// publicUrl is optional and, unlike baseUrl, allowed to be an empty string
// — the edit form's "leave blank to use the address above" affordance
// needs a way to *clear* a previously-set publicUrl back to unset, and an
// empty string is what a cleared text input submits.
//
// Restricted to http(s) (plain z.url() would otherwise accept
// javascript:/data: as "valid" too) — publicUrl flows straight into every
// adapter's per-item link construction and from there into a sent email's
// <a href>, so an admin setting a non-navigable scheme here would land the
// same way an untrusted source's own malicious content could.
const publicUrlSchema = z
  .union([
    z.url({ protocol: /^https?$/, message: "publicUrl must be an http or https URL" }),
    z.literal(""),
  ])
  .optional();

const createSourceSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  kind: z.string().trim().min(1, "kind is required"),
  baseUrl: z.url("baseUrl must be a valid URL"),
  publicUrl: publicUrlSchema,
  credentials: z.record(z.string(), z.string()),
});

// `kind` is deliberately not editable — changing it would leave stored
// credentials shaped for a different adapter; delete and re-add instead.
const updateSourceSchema = z.object({
  name: z.string().trim().min(1).optional(),
  baseUrl: z.url("baseUrl must be a valid URL").optional(),
  publicUrl: publicUrlSchema,
  credentials: z.record(z.string(), z.string()).optional(),
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
      const { name, kind, baseUrl, publicUrl, credentials } = body;

      if (!getAdapter(kind)) {
        return reply.code(400).send({ error: `Unknown source kind: ${kind}` });
      }

      const credentialsEncrypted = encrypt(JSON.stringify(credentials), getEncryptionKey());
      const [row] = await db
        .insert(sourceConnections)
        .values({ name, kind, baseUrl, publicUrl: publicUrl || null, credentialsEncrypted })
        .returning();

      request.log.info({ sourceId: row!.id, kind }, `Added ${kind} source "${name}"`);
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

    scope.patch<{ Params: IdParams }>("/sources/:id", async (request, reply) => {
      const body = parseBody(updateSourceSchema, request.body, reply);
      if (!body) return reply;
      const { name, baseUrl, publicUrl, credentials } = body;

      const [row] = await db
        .update(sourceConnections)
        .set({
          ...(name !== undefined && { name }),
          ...(baseUrl !== undefined && { baseUrl }),
          ...(publicUrl !== undefined && { publicUrl: publicUrl || null }),
          ...(credentials !== undefined && {
            credentialsEncrypted: encrypt(JSON.stringify(credentials), getEncryptionKey()),
          }),
        })
        .where(eq(sourceConnections.id, request.params.id))
        .returning();

      if (!row) {
        return reply.code(404).send({ error: "Not found" });
      }
      request.log.info({ sourceId: row.id, fields: changedFields(body) }, `Updated source "${row.name}"`);
      return reply.send({ source: sanitize(row) });
    });

    scope.delete<{ Params: IdParams }>("/sources/:id", async (request, reply) => {
      const [deleted] = await db
        .delete(sourceConnections)
        .where(eq(sourceConnections.id, request.params.id))
        .returning();
      if (deleted) {
        request.log.info({ sourceId: deleted.id }, `Deleted source "${deleted.name}"`);
      }
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
        publicUrl: row.publicUrl ?? undefined,
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

      if (result.ok) {
        request.log.info({ sourceId: row.id }, `Connection test passed for source "${row.name}"`);
      } else {
        request.log.warn(
          { sourceId: row.id, reason: result.message },
          `Connection test failed for source "${row.name}": ${result.message ?? "Unknown error"}`,
        );
      }
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
        publicUrl: row.publicUrl ?? undefined,
        credentials: decryptCredentials(row),
      });

      return reply.send({ libraries });
    });

    // 404s (not a 200 with an empty array) when the adapter doesn't
    // implement listUsers at all, so the web UI can tell "this source
    // type has no known users" apart from "it has zero users right now"
    // — the former hides the whole Import action, the latter would show
    // it with an empty result.
    scope.get<{ Params: IdParams }>("/sources/:id/users", async (request, reply) => {
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
      if (!adapter.listUsers) {
        return reply.code(404).send({ error: `${row.kind} sources don't support listing users` });
      }

      const users = await adapter.listUsers({
        baseUrl: row.baseUrl,
        publicUrl: row.publicUrl ?? undefined,
        credentials: decryptCredentials(row),
      });

      return reply.send({ users });
    });
  });
}
