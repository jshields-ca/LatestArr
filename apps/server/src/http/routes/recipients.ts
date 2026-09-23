import { type Db, recipientGroupMembers, recipientGroups, recipients } from "@latestarr/db";
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

// Rows come from client-side CSV/pasted-text parsing (see
// apps/web/src/lib/recipient-import.ts), which already does its own
// per-row email-format validation and shows the user which rows it
// couldn't parse — so `email` here is deliberately a bare string, not
// z.email(), to let a still-malformed or already-existing row come back
// as a per-row `skipped` entry instead of failing the whole batch.
const bulkImportSchema = z.object({
  rows: z
    .array(
      z.object({
        email: z.string().trim().min(1),
        displayName: z.string().trim().min(1).optional(),
      }),
    )
    .min(1)
    .max(1000),
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

    // Processes rows one at a time (rather than a single multi-row insert)
    // so one bad or duplicate row doesn't fail the whole import — the point
    // of a bulk-import endpoint is tolerating a messy paste/CSV, not
    // requiring it to be perfectly clean up front.
    scope.post("/recipients/import", async (request, reply) => {
      const body = parseBody(bulkImportSchema, request.body, reply);
      if (!body) return reply;

      const created: (typeof recipients.$inferSelect)[] = [];
      const skipped: { email: string; displayName?: string; reason: string }[] = [];
      const seenEmails = new Set<string>();

      for (const row of body.rows) {
        const emailResult = z.email().safeParse(row.email);
        if (!emailResult.success) {
          skipped.push({ email: row.email, displayName: row.displayName, reason: "Invalid email address" });
          continue;
        }
        const normalizedEmail = emailResult.data.toLowerCase();
        if (seenEmails.has(normalizedEmail)) {
          skipped.push({ email: row.email, displayName: row.displayName, reason: "Duplicate in this import" });
          continue;
        }
        seenEmails.add(normalizedEmail);

        try {
          const [recipient] = await db
            .insert(recipients)
            .values({ email: emailResult.data, displayName: row.displayName })
            .returning();
          created.push(recipient!);
        } catch (err) {
          if (isUniqueConstraintError(err)) {
            skipped.push({ email: row.email, displayName: row.displayName, reason: "Already exists" });
          } else {
            throw err;
          }
        }
      }

      return reply.code(201).send({ created, skipped });
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

    // The reverse of GET /recipient-groups/:id's `members` — lets the
    // recipient-centric Edit dialog show (and toggle) which groups a
    // recipient already belongs to without fetching every group's member
    // list to find out.
    scope.get<{ Params: IdParams }>("/recipients/:id/groups", async (request, reply) => {
      const [recipient] = await db
        .select()
        .from(recipients)
        .where(eq(recipients.id, request.params.id));
      if (!recipient) {
        return reply.code(404).send({ error: "Not found" });
      }

      const groups = await db
        .select({ group: recipientGroups })
        .from(recipientGroupMembers)
        .innerJoin(recipientGroups, eq(recipientGroupMembers.groupId, recipientGroups.id))
        .where(eq(recipientGroupMembers.recipientId, recipient.id));

      return reply.send({ groups: groups.map((row) => row.group) });
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
