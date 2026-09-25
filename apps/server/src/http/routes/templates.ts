import { type Db, templates } from "@latestarr/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { changedFields } from "../log-fields.js";
import { requireAuth } from "../require-auth.js";
import { parseBody } from "../validate.js";

const createTemplateSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  designJson: z.record(z.string(), z.unknown()).optional(),
  compiledMjml: z.string().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  designJson: z.record(z.string(), z.unknown()).optional(),
  compiledMjml: z.string().optional(),
});

interface IdParams {
  id: string;
}

export function registerTemplateRoutes(app: FastifyInstance, db: Db): void {
  void app.register(async (scope) => {
    scope.addHook("preHandler", requireAuth(db));

    scope.post("/templates", async (request, reply) => {
      const body = parseBody(createTemplateSchema, request.body, reply);
      if (!body) return reply;
      const { name, designJson, compiledMjml } = body;

      const [template] = await db
        .insert(templates)
        .values({ name, designJson: designJson ?? null, compiledMjml: compiledMjml ?? null })
        .returning();

      request.log.info({ templateId: template!.id }, `Created template "${name}"`);
      return reply.code(201).send({ template });
    });

    scope.get("/templates", async (_request, reply) => {
      const rows = await db.select().from(templates);
      return reply.send({ templates: rows });
    });

    scope.get<{ Params: IdParams }>("/templates/:id", async (request, reply) => {
      const [template] = await db.select().from(templates).where(eq(templates.id, request.params.id));
      if (!template) {
        return reply.code(404).send({ error: "Not found" });
      }
      return reply.send({ template });
    });

    scope.patch<{ Params: IdParams }>("/templates/:id", async (request, reply) => {
      const body = parseBody(updateTemplateSchema, request.body, reply);
      if (!body) return reply;
      const { name, designJson, compiledMjml } = body;

      const [template] = await db
        .update(templates)
        .set({
          ...(name !== undefined && { name }),
          ...(designJson !== undefined && { designJson }),
          ...(compiledMjml !== undefined && { compiledMjml }),
          updatedAt: new Date(),
        })
        .where(eq(templates.id, request.params.id))
        .returning();

      if (!template) {
        return reply.code(404).send({ error: "Not found" });
      }
      request.log.info({ templateId: template.id, fields: changedFields(body) }, `Saved template "${template.name}"`);
      return reply.send({ template });
    });

    scope.delete<{ Params: IdParams }>("/templates/:id", async (request, reply) => {
      const [deleted] = await db.delete(templates).where(eq(templates.id, request.params.id)).returning();
      if (deleted) {
        request.log.info({ templateId: deleted.id }, `Deleted template "${deleted.name}"`);
      }
      return reply.code(204).send();
    });
  });
}
