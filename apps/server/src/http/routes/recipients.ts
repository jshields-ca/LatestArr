import { type Db, recipientGroupMembers, recipientGroups, recipients } from "@latestarr/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { isUniqueConstraintError } from "../db-errors.js";
import { applyRecipientImport, planRecipientImport } from "./recipient-import.js";
import { changedFields } from "../log-fields.js";
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
        // Group names to add this person to (#288).
        groups: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
      }),
    )
    .min(1)
    .max(1000),
  dryRun: z.boolean().optional(),
});

interface IdParams {
  id: string;
}

export function registerRecipientRoutes(app: FastifyInstance, db: Db): void {
  void app.register(async (scope) => {
    scope.addHook("preHandler", requireAuth(db, { read: "editor", write: "editor" }));

    scope.post("/recipients", async (request, reply) => {
      const body = parseBody(createRecipientSchema, request.body, reply);
      if (!body) return reply;
      const { email, displayName } = body;

      try {
        const [recipient] = await db.insert(recipients).values({ email, displayName }).returning();
        request.log.info({ recipientId: recipient!.id }, `Added recipient ${email}`);
        return reply.code(201).send({ recipient });
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          return reply.code(409).send({ error: "A recipient with this email already exists" });
        }
        throw err;
      }
    });

    // A messy paste or CSV is fine: bad and duplicate rows are skipped with
    // a reason rather than failing the import (recipient-import.ts). With
    // dryRun, says what the import would do without changing anything
    // (#288); the web app shows that before the user confirms.
    scope.post("/recipients/import", async (request, reply) => {
      const body = parseBody(bulkImportSchema, request.body, reply);
      if (!body) return reply;

      if (body.dryRun) {
        return reply.send({ plan: planRecipientImport(db, body.rows) });
      }

      const { plan, created, updated, createdGroups, membershipsAdded } = applyRecipientImport(db, body.rows);
      request.log.info(
        {
          created: created.length,
          updated: updated.length,
          unchanged: plan.unchanged.length,
          skipped: plan.skipped.length,
          groupsCreated: createdGroups.length,
          membershipsAdded,
        },
        `Imported recipients: ${created.length} added, ${updated.length} renamed, ${membershipsAdded} added to groups` +
          (createdGroups.length ? ` (${createdGroups.length} new)` : "") +
          (plan.skipped.length ? `, ${plan.skipped.length} skipped` : ""),
      );
      return reply
        .code(201)
        .send({ created, updated, unchanged: plan.unchanged, skipped: plan.skipped, createdGroups, membershipsAdded });
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
        const fields = changedFields(body);
        const message =
          fields.length === 1 && isActive !== undefined
            ? `${isActive ? "Activated" : "Deactivated"} recipient ${recipient.email}`
            : `Updated recipient ${recipient.email}`;
        request.log.info({ recipientId: recipient.id, fields }, message);
        return reply.send({ recipient });
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          return reply.code(409).send({ error: "A recipient with this email already exists" });
        }
        throw err;
      }
    });

    scope.delete<{ Params: IdParams }>("/recipients/:id", async (request, reply) => {
      const [deleted] = await db.delete(recipients).where(eq(recipients.id, request.params.id)).returning();
      if (deleted) {
        request.log.info({ recipientId: deleted.id }, `Deleted recipient ${deleted.email}`);
      }
      return reply.code(204).send();
    });
  });
}
