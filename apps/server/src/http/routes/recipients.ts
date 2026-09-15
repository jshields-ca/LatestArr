import { type Db, recipients } from "@latestarr/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { isUniqueConstraintError } from "../db-errors.js";
import { requireAuth } from "../require-auth.js";
import { parseBody } from "../validate.js";

const createRecipientSchema = z.object({
  email: z.email("A valid email is required"),
  displayName: z.string().trim().min(1).optional(),
});

const updateRecipientSchema = z.object({
  email: z.email("A valid email is required").optional(),
  displayName: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
});

interface IdParams {
  id: string;
}

export function registerRecipientRoutes(app: FastifyInstance, db: Db): void {
  void app.register(async (scope) => {
    scope.addHook("preHandler", requireAuth(db));

    scope.post("/recipients", async (request, reply) => {
      const body = parseBody(createRecipientSchema, request.body, reply);
      if (!body) return reply;
      const { email, displayName } = body;

      try {
        const [recipient] = await db.insert(recipients).values({ email, displayName }).returning();
        return reply.code(201).send({ recipient });
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          return reply.code(409).send({ error: "A recipient with this email already exists" });
        }
        throw err;
      }
    });

    scope.get("/recipients", async (_request, reply) => {
      const rows = await db.select().from(recipients);
      return reply.send({ recipients: rows });
    });

    scope.get<{ Params: IdParams }>("/recipients/:id", async (request, reply) => {
      const [recipient] = await db
        .select()
        .from(recipients)
        .where(eq(recipients.id, request.params.id));
      if (!recipient) {
        return reply.code(404).send({ error: "Not found" });
      }
      return reply.send({ recipient });
    });

    scope.patch<{ Params: IdParams }>("/recipients/:id", async (request, reply) => {
      const body = parseBody(updateRecipientSchema, request.body, reply);
      if (!body) return reply;
      const { email, displayName, isActive } = body;

      try {
        const [recipient] = await db
          .update(recipients)
          .set({
            ...(email !== undefined && { email }),
            ...(displayName !== undefined && { displayName }),
            ...(isActive !== undefined && { isActive }),
          })
          .where(eq(recipients.id, request.params.id))
          .returning();

        if (!recipient) {
          return reply.code(404).send({ error: "Not found" });
        }
        return reply.send({ recipient });
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          return reply.code(409).send({ error: "A recipient with this email already exists" });
        }
        throw err;
      }
    });

    scope.delete<{ Params: IdParams }>("/recipients/:id", async (request, reply) => {
      await db.delete(recipients).where(eq(recipients.id, request.params.id));
      return reply.code(204).send();
    });
  });
}
