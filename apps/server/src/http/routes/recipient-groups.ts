import {
  type Db,
  recipientGroupMembers,
  recipientGroups,
  recipients,
} from "@latestarr/db";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { isUniqueConstraintError } from "../db-errors.js";
import { requireAuth } from "../require-auth.js";
import { parseBody } from "../validate.js";

const createGroupSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  description: z.string().trim().min(1).optional(),
});

const updateGroupSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
});

const addMemberSchema = z.object({
  recipientId: z.string().min(1, "recipientId is required"),
});

interface IdParams {
  id: string;
}

interface GroupMemberParams {
  id: string;
  recipientId: string;
}

export function registerRecipientGroupRoutes(app: FastifyInstance, db: Db): void {
  void app.register(async (scope) => {
    scope.addHook("preHandler", requireAuth(db));

    scope.post("/recipient-groups", async (request, reply) => {
      const body = parseBody(createGroupSchema, request.body, reply);
      if (!body) return reply;

      const [group] = await db
        .insert(recipientGroups)
        .values({ name: body.name, description: body.description })
        .returning();
      return reply.code(201).send({ group });
    });

    scope.get("/recipient-groups", async (_request, reply) => {
      const rows = await db.select().from(recipientGroups);
      return reply.send({ groups: rows });
    });

    scope.get<{ Params: IdParams }>("/recipient-groups/:id", async (request, reply) => {
      const [group] = await db
        .select()
        .from(recipientGroups)
        .where(eq(recipientGroups.id, request.params.id));
      if (!group) {
        return reply.code(404).send({ error: "Not found" });
      }

      const members = await db
        .select({ recipient: recipients })
        .from(recipientGroupMembers)
        .innerJoin(recipients, eq(recipientGroupMembers.recipientId, recipients.id))
        .where(eq(recipientGroupMembers.groupId, group.id));

      return reply.send({ group, members: members.map((row) => row.recipient) });
    });

    scope.patch<{ Params: IdParams }>("/recipient-groups/:id", async (request, reply) => {
      const body = parseBody(updateGroupSchema, request.body, reply);
      if (!body) return reply;
      const { name, description } = body;

      const [group] = await db
        .update(recipientGroups)
        .set({
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
        })
        .where(eq(recipientGroups.id, request.params.id))
        .returning();

      if (!group) {
        return reply.code(404).send({ error: "Not found" });
      }
      return reply.send({ group });
    });

    scope.delete<{ Params: IdParams }>("/recipient-groups/:id", async (request, reply) => {
      await db.delete(recipientGroups).where(eq(recipientGroups.id, request.params.id));
      return reply.code(204).send();
    });

    scope.post<{ Params: IdParams }>(
      "/recipient-groups/:id/members",
      async (request, reply) => {
        const body = parseBody(addMemberSchema, request.body, reply);
        if (!body) return reply;
        const { recipientId } = body;

        const [group] = await db
          .select()
          .from(recipientGroups)
          .where(eq(recipientGroups.id, request.params.id));
        if (!group) {
          return reply.code(404).send({ error: "Group not found" });
        }

        const [recipient] = await db
          .select()
          .from(recipients)
          .where(eq(recipients.id, recipientId));
        if (!recipient) {
          return reply.code(404).send({ error: "Recipient not found" });
        }

        try {
          await db.insert(recipientGroupMembers).values({ groupId: group.id, recipientId });
        } catch (err) {
          if (isUniqueConstraintError(err)) {
            return reply.code(409).send({ error: "Recipient is already a member of this group" });
          }
          throw err;
        }

        return reply.code(204).send();
      },
    );

    scope.delete<{ Params: GroupMemberParams }>(
      "/recipient-groups/:id/members/:recipientId",
      async (request, reply) => {
        await db
          .delete(recipientGroupMembers)
          .where(
            and(
              eq(recipientGroupMembers.groupId, request.params.id),
              eq(recipientGroupMembers.recipientId, request.params.recipientId),
            ),
          );
        return reply.code(204).send();
      },
    );
  });
}
