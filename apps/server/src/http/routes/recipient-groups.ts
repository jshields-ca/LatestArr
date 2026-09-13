import {
  type Db,
  recipientGroupMembers,
  recipientGroups,
  recipients,
} from "@latestarr/db";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { isUniqueConstraintError } from "../db-errors.js";
import { requireAuth } from "../require-auth.js";

interface CreateGroupBody {
  name?: string;
  description?: string;
}

interface UpdateGroupBody {
  name?: string;
  description?: string;
}

interface IdParams {
  id: string;
}

interface GroupMemberParams {
  id: string;
  recipientId: string;
}

interface AddMemberBody {
  recipientId?: string;
}

export function registerRecipientGroupRoutes(app: FastifyInstance, db: Db): void {
  void app.register(async (scope) => {
    scope.addHook("preHandler", requireAuth(db));

    scope.post<{ Body: CreateGroupBody }>("/recipient-groups", async (request, reply) => {
      const { name, description } = request.body ?? {};
      if (!name) {
        return reply.code(400).send({ error: "name is required" });
      }

      const [group] = await db.insert(recipientGroups).values({ name, description }).returning();
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

    scope.patch<{ Params: IdParams; Body: UpdateGroupBody }>(
      "/recipient-groups/:id",
      async (request, reply) => {
        const { name, description } = request.body ?? {};
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
      },
    );

    scope.delete<{ Params: IdParams }>("/recipient-groups/:id", async (request, reply) => {
      await db.delete(recipientGroups).where(eq(recipientGroups.id, request.params.id));
      return reply.code(204).send();
    });

    scope.post<{ Params: IdParams; Body: AddMemberBody }>(
      "/recipient-groups/:id/members",
      async (request, reply) => {
        const { recipientId } = request.body ?? {};
        if (!recipientId) {
          return reply.code(400).send({ error: "recipientId is required" });
        }

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
