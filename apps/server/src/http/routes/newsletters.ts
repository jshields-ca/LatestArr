import {
  type Db,
  newsletterRecipientGroups,
  newsletterSources,
  newsletters,
  recipientGroups,
  sendRuns,
  sourceConnections,
} from "@latestarr/db";
import { and, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
  NewsletterMisconfiguredError,
  NewsletterNotFoundError,
  runNewsletter,
  SendAlreadyRunningError,
} from "../../pipeline/run-newsletter.js";
import type { SchedulerHandle } from "../../scheduler/engine.js";
import { refreshScheduler } from "../../scheduler/engine.js";
import { isUniqueConstraintError } from "../db-errors.js";
import { requireAuth } from "../require-auth.js";

interface SenderIdentity {
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
}

interface CreateNewsletterBody {
  name?: string;
  scheduleCron?: string;
  timezone?: string;
  subjectTemplate?: string;
  lookbackDays?: number;
  smtpProfileId?: string;
  templateId?: string;
  senderIdentity?: SenderIdentity;
}

interface UpdateNewsletterBody {
  name?: string;
  scheduleCron?: string;
  timezone?: string;
  subjectTemplate?: string;
  lookbackDays?: number;
  isEnabled?: boolean;
  smtpProfileId?: string | null;
  templateId?: string | null;
  senderIdentity?: SenderIdentity;
}

interface IdParams {
  id: string;
}

interface AddSourceBody {
  sourceConnectionId?: string;
  mediaTypeFilter?: string[];
  libraryFilter?: string[];
}

interface NewsletterSourceParams {
  id: string;
  sourceConnectionId: string;
}

interface AddRecipientGroupBody {
  groupId?: string;
}

interface NewsletterGroupParams {
  id: string;
  groupId: string;
}

export function registerNewsletterRoutes(app: FastifyInstance, db: Db, scheduler?: SchedulerHandle): void {
  async function refreshSchedule(): Promise<void> {
    if (scheduler) {
      await refreshScheduler(scheduler, db);
    }
  }

  void app.register(async (scope) => {
    scope.addHook("preHandler", requireAuth(db));

    scope.post<{ Body: CreateNewsletterBody }>("/newsletters", async (request, reply) => {
      const {
        name,
        scheduleCron,
        timezone,
        subjectTemplate,
        lookbackDays,
        smtpProfileId,
        templateId,
        senderIdentity,
      } = request.body ?? {};
      if (!name || !scheduleCron) {
        return reply.code(400).send({ error: "name and scheduleCron are required" });
      }

      const [newsletter] = await db
        .insert(newsletters)
        .values({
          name,
          scheduleCron,
          ...(timezone !== undefined && { timezone }),
          ...(subjectTemplate !== undefined && { subjectTemplate }),
          ...(lookbackDays !== undefined && { lookbackDays }),
          ...(smtpProfileId !== undefined && { smtpProfileId }),
          ...(templateId !== undefined && { templateId }),
          ...(senderIdentity !== undefined && { senderIdentity }),
        })
        .returning();

      await refreshSchedule();
      return reply.code(201).send({ newsletter });
    });

    scope.get("/newsletters", async (_request, reply) => {
      const rows = await db.select().from(newsletters);
      return reply.send({ newsletters: rows });
    });

    scope.get<{ Params: IdParams }>("/newsletters/:id", async (request, reply) => {
      const [newsletter] = await db
        .select()
        .from(newsletters)
        .where(eq(newsletters.id, request.params.id));
      if (!newsletter) {
        return reply.code(404).send({ error: "Not found" });
      }

      const sources = await db
        .select({ source: sourceConnections, filters: newsletterSources })
        .from(newsletterSources)
        .innerJoin(sourceConnections, eq(newsletterSources.sourceConnectionId, sourceConnections.id))
        .where(eq(newsletterSources.newsletterId, newsletter.id));

      const groups = await db
        .select({ group: recipientGroups })
        .from(newsletterRecipientGroups)
        .innerJoin(recipientGroups, eq(newsletterRecipientGroups.groupId, recipientGroups.id))
        .where(eq(newsletterRecipientGroups.newsletterId, newsletter.id));

      return reply.send({
        newsletter,
        sources: sources.map((row) => ({
          ...row.source,
          mediaTypeFilter: row.filters.mediaTypeFilter,
          libraryFilter: row.filters.libraryFilter,
        })),
        recipientGroups: groups.map((row) => row.group),
      });
    });

    scope.patch<{ Params: IdParams; Body: UpdateNewsletterBody }>(
      "/newsletters/:id",
      async (request, reply) => {
        const {
          name,
          scheduleCron,
          timezone,
          subjectTemplate,
          lookbackDays,
          isEnabled,
          smtpProfileId,
          templateId,
          senderIdentity,
        } = request.body ?? {};

        const [newsletter] = await db
          .update(newsletters)
          .set({
            ...(name !== undefined && { name }),
            ...(scheduleCron !== undefined && { scheduleCron }),
            ...(timezone !== undefined && { timezone }),
            ...(subjectTemplate !== undefined && { subjectTemplate }),
            ...(lookbackDays !== undefined && { lookbackDays }),
            ...(isEnabled !== undefined && { isEnabled }),
            ...(smtpProfileId !== undefined && { smtpProfileId }),
            ...(templateId !== undefined && { templateId }),
            ...(senderIdentity !== undefined && { senderIdentity }),
            updatedAt: new Date(),
          })
          .where(eq(newsletters.id, request.params.id))
          .returning();

        if (!newsletter) {
          return reply.code(404).send({ error: "Not found" });
        }
        await refreshSchedule();
        return reply.send({ newsletter });
      },
    );

    scope.delete<{ Params: IdParams }>("/newsletters/:id", async (request, reply) => {
      await db.delete(newsletters).where(eq(newsletters.id, request.params.id));
      await refreshSchedule();
      return reply.code(204).send();
    });

    scope.post<{ Params: IdParams; Body: AddSourceBody }>(
      "/newsletters/:id/sources",
      async (request, reply) => {
        const { sourceConnectionId, mediaTypeFilter, libraryFilter } = request.body ?? {};
        if (!sourceConnectionId) {
          return reply.code(400).send({ error: "sourceConnectionId is required" });
        }

        const [newsletter] = await db
          .select()
          .from(newsletters)
          .where(eq(newsletters.id, request.params.id));
        if (!newsletter) {
          return reply.code(404).send({ error: "Newsletter not found" });
        }

        const [source] = await db
          .select()
          .from(sourceConnections)
          .where(eq(sourceConnections.id, sourceConnectionId));
        if (!source) {
          return reply.code(404).send({ error: "Source connection not found" });
        }

        try {
          await db.insert(newsletterSources).values({
            newsletterId: newsletter.id,
            sourceConnectionId,
            mediaTypeFilter,
            libraryFilter,
          });
        } catch (err) {
          if (isUniqueConstraintError(err)) {
            return reply.code(409).send({ error: "Source is already linked to this newsletter" });
          }
          throw err;
        }

        return reply.code(204).send();
      },
    );

    scope.delete<{ Params: NewsletterSourceParams }>(
      "/newsletters/:id/sources/:sourceConnectionId",
      async (request, reply) => {
        await db
          .delete(newsletterSources)
          .where(
            and(
              eq(newsletterSources.newsletterId, request.params.id),
              eq(newsletterSources.sourceConnectionId, request.params.sourceConnectionId),
            ),
          );
        return reply.code(204).send();
      },
    );

    scope.post<{ Params: IdParams; Body: AddRecipientGroupBody }>(
      "/newsletters/:id/recipient-groups",
      async (request, reply) => {
        const { groupId } = request.body ?? {};
        if (!groupId) {
          return reply.code(400).send({ error: "groupId is required" });
        }

        const [newsletter] = await db
          .select()
          .from(newsletters)
          .where(eq(newsletters.id, request.params.id));
        if (!newsletter) {
          return reply.code(404).send({ error: "Newsletter not found" });
        }

        const [group] = await db
          .select()
          .from(recipientGroups)
          .where(eq(recipientGroups.id, groupId));
        if (!group) {
          return reply.code(404).send({ error: "Recipient group not found" });
        }

        try {
          await db.insert(newsletterRecipientGroups).values({ newsletterId: newsletter.id, groupId });
        } catch (err) {
          if (isUniqueConstraintError(err)) {
            return reply.code(409).send({ error: "Group is already linked to this newsletter" });
          }
          throw err;
        }

        return reply.code(204).send();
      },
    );

    scope.delete<{ Params: NewsletterGroupParams }>(
      "/newsletters/:id/recipient-groups/:groupId",
      async (request, reply) => {
        await db
          .delete(newsletterRecipientGroups)
          .where(
            and(
              eq(newsletterRecipientGroups.newsletterId, request.params.id),
              eq(newsletterRecipientGroups.groupId, request.params.groupId),
            ),
          );
        return reply.code(204).send();
      },
    );

    scope.post<{ Params: IdParams }>("/newsletters/:id/send-now", async (request, reply) => {
      try {
        const result = await runNewsletter(db, request.params.id);
        return reply.send(result);
      } catch (err) {
        if (err instanceof NewsletterNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        if (err instanceof NewsletterMisconfiguredError) {
          return reply.code(400).send({ error: err.message });
        }
        if (err instanceof SendAlreadyRunningError) {
          return reply.code(409).send({ error: err.message });
        }
        throw err;
      }
    });

    scope.get<{ Params: IdParams }>("/newsletters/:id/send-runs", async (request, reply) => {
      const rows = await db
        .select()
        .from(sendRuns)
        .where(eq(sendRuns.newsletterId, request.params.id))
        .orderBy(desc(sendRuns.startedAt));
      return reply.send({ sendRuns: rows });
    });
  });
}
