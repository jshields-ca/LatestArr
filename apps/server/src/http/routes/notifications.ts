import type { Db } from "@latestarr/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  loadNotificationSettings,
  type NotificationSettings,
  saveNotificationSettings,
  sendTestAlert,
  WEBHOOK_FORMATS,
} from "../../notifications/alerts.js";
import { requireAuth } from "../require-auth.js";
import { parseBody } from "../validate.js";

const settingsSchema = z
  .object({
    onFailure: z.boolean(),
    onPartialFailure: z.boolean(),
    email: z.object({
      enabled: z.boolean(),
      smtpProfileId: z.string().min(1).nullable(),
      to: z.union([z.email("Enter a valid alert email address"), z.literal("")]),
    }),
    webhook: z.object({
      enabled: z.boolean(),
      format: z.enum(WEBHOOK_FORMATS),
      // Omitted keeps the saved URL (the UI never receives it back);
      // null clears it.
      url: z.url({ protocol: /^https?$/, message: "The webhook URL must be an http or https URL" }).nullable().optional(),
    }),
  })
  .refine((value) => !value.email.enabled || (value.email.smtpProfileId && value.email.to), {
    message: "Choose an SMTP profile and an email address for email alerts",
  });

type SettingsBody = z.infer<typeof settingsSchema>;

function merge(body: SettingsBody, saved: NotificationSettings): NotificationSettings {
  return {
    ...body,
    webhook: {
      enabled: body.webhook.enabled,
      format: body.webhook.format,
      url: body.webhook.url === undefined ? saved.webhook.url : body.webhook.url,
    },
  };
}

// The webhook URL itself never goes back to the browser, only whether one
// is saved and which host it points at.
function publicView(value: NotificationSettings) {
  let urlHost: string | null = null;
  if (value.webhook.url) {
    try {
      urlHost = new URL(value.webhook.url).host;
    } catch {
      urlHost = null;
    }
  }
  return {
    ...value,
    webhook: { enabled: value.webhook.enabled, format: value.webhook.format, hasUrl: Boolean(value.webhook.url), urlHost },
  };
}

export function registerNotificationRoutes(app: FastifyInstance, db: Db): void {
  void app.register(async (scope) => {
    scope.addHook("preHandler", requireAuth(db, { read: "admin", write: "admin" }));

    scope.get("/notifications", async (_request, reply) => {
      return reply.send({ settings: publicView(await loadNotificationSettings(db)) });
    });

    scope.put("/notifications", async (request, reply) => {
      const body = parseBody(settingsSchema, request.body, reply);
      if (!body) return reply;
      const next = merge(body, await loadNotificationSettings(db));
      if (next.webhook.enabled && !next.webhook.url) {
        return reply.code(400).send({ error: "Enter a webhook URL, or turn webhook alerts off" });
      }
      await saveNotificationSettings(db, next);
      request.log.info(
        { email: next.email.enabled, webhook: next.webhook.enabled ? next.webhook.format : false },
        "Updated failure alert settings",
      );
      return reply.send({ settings: publicView(next) });
    });

    // Tests the settings as currently entered, saved or not, so a URL can be
    // checked before it's saved.
    scope.post("/notifications/test", async (request, reply) => {
      const body = parseBody(settingsSchema, request.body, reply);
      if (!body) return reply;
      const config = merge(body, await loadNotificationSettings(db));
      if (!config.email.enabled && !config.webhook.enabled) {
        return reply.code(400).send({ error: "Turn on email or webhook alerts first" });
      }
      const results = await sendTestAlert(db, config);
      for (const result of results) {
        if (result.ok) request.log.info(`Sent a test ${result.destination} alert`);
        else request.log.warn({ reason: result.error }, `Test ${result.destination} alert failed: ${result.error}`);
      }
      return reply.send({ results });
    });
  });
}
