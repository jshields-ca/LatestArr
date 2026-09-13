import { type Db, recipients } from "@latestarr/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { isUniqueConstraintError } from "../db-errors.js";
import { requireAuth } from "../require-auth.js";

interface CreateRecipientBody {
  email?: string;
  displayName?: string;
}

interface UpdateRecipientBody {
  displayName?: string;
  isActive?: boolean;
}

interface IdParams {
  id: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function registerRecipientRoutes(app: FastifyInstance, db: Db): void {
  void app.register(async (scope) => {
    scope.addHook("preHandler", requireAuth(db));

    scope.post<{ Body: CreateRecipientBody }>("/recipients", async (request, reply) => {
      const { email, displayName } = request.body ?? {};
      if (!email || !EMAIL_PATTERN.test(email)) {
        return reply.code(400).send({ error: "A valid email is required" });
      }

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

    scope.patch<{ Params: IdParams; Body: UpdateRecipientBody }>(
      "/recipients/:id",
      async (request, reply) => {
        const { displayName, isActive } = request.body ?? {};
        const [recipient] = await db
          .update(recipients)
          .set({
            ...(displayName !== undefined && { displayName }),
            ...(isActive !== undefined && { isActive }),
          })
          .where(eq(recipients.id, request.params.id))
          .returning();

        if (!recipient) {
          return reply.code(404).send({ error: "Not found" });
        }
        return reply.send({ recipient });
      },
    );

    scope.delete<{ Params: IdParams }>("/recipients/:id", async (request, reply) => {
      await db.delete(recipients).where(eq(recipients.id, request.params.id));
      return reply.code(204).send();
    });
  });
}
