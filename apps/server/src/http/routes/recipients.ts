import { type Db, recipientGroupMembers, recipientGroups, recipients } from "@latestarr/db";
import { and, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { isUniqueConstraintError } from "../db-errors.js";
import {
  applyRecipientImport,
  ImportNotUndoableError,
  latestImport,
  planRecipientImport,
  undoRecipientImport,
} from "./recipient-import.js";
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

// One change to many recipients at once (#400). The web app sends the ids
// it has selected, so "everyone matching this search" is still one request
// and one line on the Logs page.
const BULK_MAX_RECIPIENTS = 5000;
const bulkIds = z.array(z.string().min(1).max(64)).min(1).max(BULK_MAX_RECIPIENTS);
const bulkSchema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["activate", "deactivate", "delete"]), ids: bulkIds }),
  z.object({ action: z.enum(["addToGroup", "removeFromGroup"]), ids: bulkIds, groupId: z.string().min(1).max(64) }),
]);

// SQLite caps the variables in one statement; ids go through in batches
// well under it, all inside one transaction.
const BULK_BATCH = 500;
function batches<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += BULK_BATCH) out.push(items.slice(i, i + BULK_BATCH));
  return out;
}

// How many addresses a bulk change's log entry names; the rest are a count.
const BULK_LOG_EMAILS = 25;

function recipientCount(count: number): string {
  return `${count} recipient${count === 1 ? "" : "s"}`;
}

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

      const { plan, created, updated, createdGroups, membershipsAdded, importId } = applyRecipientImport(
        db,
        body.rows,
        request.sessionUser?.id ?? null,
      );
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
        .send({ created, updated, unchanged: plan.unchanged, skipped: plan.skipped, createdGroups, membershipsAdded, importId });
    });

    // Applies one change to every recipient listed. Ids that don't exist
    // (deleted in another tab, say) are skipped, and so is anyone the change
    // wouldn't alter: `changed` counts only who it did. All or nothing.
    scope.post("/recipients/bulk", async (request, reply) => {
      const body = parseBody(bulkSchema, request.body, reply);
      if (!body) return reply;
      const ids = [...new Set(body.ids)];

      const result = db.transaction((tx) => {
        let groupName: string | null = null;
        if (body.action === "addToGroup" || body.action === "removeFromGroup") {
          const [group] = tx.select().from(recipientGroups).where(eq(recipientGroups.id, body.groupId)).all();
          if (!group) return null;
          groupName = group.name;
        }

        const changedIds: string[] = [];
        for (const batch of batches(ids)) {
          switch (body.action) {
            case "activate":
            case "deactivate": {
              const isActive = body.action === "activate";
              const rows = tx
                .update(recipients)
                .set({ isActive })
                .where(and(inArray(recipients.id, batch), eq(recipients.isActive, !isActive)))
                .returning({ id: recipients.id })
                .all();
              changedIds.push(...rows.map((row) => row.id));
              break;
            }
            case "addToGroup": {
              const existing = tx
                .select({ id: recipients.id })
                .from(recipients)
                .where(inArray(recipients.id, batch))
                .all();
              if (existing.length === 0) break;
              const rows = tx
                .insert(recipientGroupMembers)
                .values(existing.map((row) => ({ recipientId: row.id, groupId: body.groupId })))
                .onConflictDoNothing()
                .returning({ id: recipientGroupMembers.recipientId })
                .all();
              changedIds.push(...rows.map((row) => row.id));
              break;
            }
            case "removeFromGroup": {
              const rows = tx
                .delete(recipientGroupMembers)
                .where(
                  and(
                    eq(recipientGroupMembers.groupId, body.groupId),
                    inArray(recipientGroupMembers.recipientId, batch),
                  ),
                )
                .returning({ id: recipientGroupMembers.recipientId })
                .all();
              changedIds.push(...rows.map((row) => row.id));
              break;
            }
            case "delete":
              // Named before they go: the log entry below says who.
              break;
          }
        }

        // Who it changed, for the log. A delete reads them first.
        const emails: string[] = [];
        const named = body.action === "delete" ? ids : changedIds;
        for (const batch of batches(named.slice(0, BULK_LOG_EMAILS))) {
          const rows = tx.select({ email: recipients.email }).from(recipients).where(inArray(recipients.id, batch)).all();
          emails.push(...rows.map((row) => row.email));
        }
        if (body.action === "delete") {
          for (const batch of batches(ids)) {
            const rows = tx.delete(recipients).where(inArray(recipients.id, batch)).returning({ id: recipients.id }).all();
            changedIds.push(...rows.map((row) => row.id));
          }
        }
        return { changed: changedIds.length, emails, groupName };
      });

      if (!result) return reply.code(404).send({ error: "Group not found" });
      const { changed, emails, groupName } = result;

      if (changed > 0) {
        const who = recipientCount(changed);
        const message = {
          activate: `Activated ${who}`,
          deactivate: `Deactivated ${who}`,
          delete: `Deleted ${who}`,
          addToGroup: `Added ${who} to group "${groupName}"`,
          removeFromGroup: `Removed ${who} from group "${groupName}"`,
        }[body.action];
        request.log.info(
          {
            action: body.action,
            changed,
            requested: ids.length,
            ...("groupId" in body && { groupId: body.groupId }),
            recipients: emails,
            ...(changed > emails.length && { andMore: changed - emails.length }),
          },
          message,
        );
      }
      return reply.send({ changed, requested: ids.length });
    });

    // The latest import, and whether it can still be undone (#288).
    scope.get("/recipients/imports/latest", async (_request, reply) => {
      return reply.send({ import: latestImport(db) });
    });

    scope.post<{ Params: IdParams }>("/recipients/imports/:id/undo", async (request, reply) => {
      try {
        const result = undoRecipientImport(db, request.params.id);
        request.log.info(
          { importId: request.params.id, ...result.undone, skipped: result.skipped.length },
          `Undid the last recipient import: ${result.undone.removed} removed, ${result.undone.renamed} renamed back, ` +
            `${result.undone.leftGroups} group memberships and ${result.undone.removedGroups} groups removed` +
            (result.skipped.length ? ` (${result.skipped.length} kept because they changed since)` : ""),
        );
        return reply.send(result);
      } catch (err) {
        if (err instanceof ImportNotUndoableError) return reply.code(409).send({ error: err.message });
        throw err;
      }
    });

    scope.get("/recipients", async (_request, reply) => {
      const rows = await db.select().from(recipients);
      // Who is in which group, so the table can show and filter by it
      // without a request per person (#332).
      const memberships = await db.select().from(recipientGroupMembers);
      return reply.send({ recipients: rows, memberships });
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
