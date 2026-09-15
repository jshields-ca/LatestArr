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
import { z } from "zod";
import {
  describeSendFailure,
  NewsletterMisconfiguredError,
  NewsletterNotFoundError,
  runNewsletter,
  SendAlreadyRunningError,
} from "../../pipeline/run-newsletter.js";
import type { SchedulerHandle } from "../../scheduler/engine.js";
import { refreshScheduler } from "../../scheduler/engine.js";
import { isUniqueConstraintError } from "../db-errors.js";
import { requireAuth } from "../require-auth.js";
import { parseBody } from "../validate.js";

const senderIdentitySchema = z.object({
  fromName: z.string().trim().min(1).optional(),
  fromEmail: z.email().optional(),
  replyTo: z.email().optional(),
});

const createNewsletterSchema = z.object({
  name: z.string().trim().min(1, "name and scheduleCron are required"),
  scheduleCron: z.string().trim().min(1, "name and scheduleCron are required"),
  timezone: z.string().trim().min(1).optional(),
  subjectTemplate: z.string().optional(),
  lookbackDays: z.number().int().positive().optional(),
  smtpProfileId: z.string().min(1).optional(),
  templateId: z.string().min(1).optional(),
  senderIdentity: senderIdentitySchema.optional(),
});

const updateNewsletterSchema = z.object({
  name: z.string().trim().min(1).optional(),
  scheduleCron: z.string().trim().min(1).optional(),
  timezone: z.string().trim().min(1).optional(),
  subjectTemplate: z.string().optional(),
  lookbackDays: z.number().int().positive().optional(),
  isEnabled: z.boolean().optional(),
  smtpProfileId: z.string().min(1).nullable().optional(),
  templateId: z.string().min(1).nullable().optional(),
  senderIdentity: senderIdentitySchema.optional(),
});

const addSourceSchema = z.object({
  sourceConnectionId: z.string().min(1, "sourceConnectionId is required"),
  mediaTypeFilter: z.array(z.string()).optional(),
  libraryFilter: z.array(z.string()).optional(),
});

const addRecipientGroupSchema = z.object({
  groupId: z.string().min(1, "groupId is required"),
});

interface IdParams {
  id: string;
}

interface NewsletterSourceParams {
  id: string;
  sourceConnectionId: string;
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

    scope.post("/newsletters", async (request, reply) => {
      const body = parseBody(createNewsletterSchema, request.body, reply);
      if (!body) return reply;
      const {
        name,
        scheduleCron,
        timezone,
        subjectTemplate,
        lookbackDays,
        smtpProfileId,
        templateId,
        senderIdentity,
      } = body;

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

    scope.patch<{ Params: IdParams }>("/newsletters/:id", async (request, reply) => {
      const body = parseBody(updateNewsletterSchema, request.body, reply);
      if (!body) return reply;
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
      } = body;

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
    });

    scope.delete<{ Params: IdParams }>("/newsletters/:id", async (request, reply) => {
      await db.delete(newsletters).where(eq(newsletters.id, request.params.id));
      await refreshSchedule();
      return reply.code(204).send();
    });

    scope.post<{ Params: IdParams }>(
      "/newsletters/:id/sources",
      async (request, reply) => {
        const body = parseBody(addSourceSchema, request.body, reply);
        if (!body) return reply;
        const { sourceConnectionId, mediaTypeFilter, libraryFilter } = body;

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

    scope.post<{ Params: IdParams }>(
      "/newsletters/:id/recipient-groups",
      async (request, reply) => {
        const body = parseBody(addRecipientGroupSchema, request.body, reply);
        if (!body) return reply;
        const { groupId } = body;

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
        // A genuine pipeline failure (source fetch, template render, SMTP,
        // ...) — runNewsletter has already recorded it on the SendRun row
        // and rethrown. Without this catch, it would fall through to
        // Fastify's default error handler and reach the frontend as a bare
        // "Internal Server Error" (see describeSendFailure for why). 502
        // since this is almost always this newsletter's own upstream
        // dependency (a source or the SMTP server), not this API itself.
        request.log.error({ err }, "Newsletter send failed");
        return reply.code(502).send({ error: describeSendFailure(err) });
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
