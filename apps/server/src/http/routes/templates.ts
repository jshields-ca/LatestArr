import { type Db, templates } from "@latestarr/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../require-auth.js";

interface CreateTemplateBody {
  name?: string;
  designJson?: Record<string, unknown>;
}

interface UpdateTemplateBody {
  name?: string;
  designJson?: Record<string, unknown>;
}

interface IdParams {
  id: string;
}

export function registerTemplateRoutes(app: FastifyInstance, db: Db): void {
  void app.register(async (scope) => {
    scope.addHook("preHandler", requireAuth(db));

    scope.post<{ Body: CreateTemplateBody }>("/templates", async (request, reply) => {
      const { name, designJson } = request.body ?? {};
      if (!name) {
        return reply.code(400).send({ error: "name is required" });
      }

      const [template] = await db
        .insert(templates)
        .values({ name, designJson: designJson ?? null })
        .returning();

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

    scope.patch<{ Params: IdParams; Body: UpdateTemplateBody }>(
      "/templates/:id",
      async (request, reply) => {
        const { name, designJson } = request.body ?? {};
        const [template] = await db
          .update(templates)
          .set({
            ...(name !== undefined && { name }),
            ...(designJson !== undefined && { designJson }),
            updatedAt: new Date(),
          })
          .where(eq(templates.id, request.params.id))
          .returning();

        if (!template) {
          return reply.code(404).send({ error: "Not found" });
        }
        return reply.send({ template });
      },
    );

    scope.delete<{ Params: IdParams }>("/templates/:id", async (request, reply) => {
      await db.delete(templates).where(eq(templates.id, request.params.id));
      return reply.code(204).send();
    });
  });
}
