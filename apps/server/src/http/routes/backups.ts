import { createReadStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import path from "node:path";
import type { Db } from "@latestarr/db";
import { Cron } from "croner";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { runBackup, type BackupScheduler } from "../../backups/runner.js";
import {
  BackupAlreadyRunningError,
  type BackupContext,
  findBackup,
  listBackups,
  loadBackupSettings,
  loadLastRun,
  nextBackupRun,
  saveBackupSettings,
} from "../../backups/service.js";
import { requireAuth } from "../require-auth.js";
import { parseBody } from "../validate.js";

const settingsSchema = z
  .object({
    enabled: z.boolean(),
    scheduleCron: z.string().trim().min(1),
    timezone: z.string().trim().min(1),
    retention: z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("count"), keep: z.number().int().min(1, "Keep at least one backup").max(365) }),
      z.object({
        mode: z.literal("calendar"),
        daily: z.number().int().min(0).max(90),
        weekly: z.number().int().min(0).max(52),
        monthly: z.number().int().min(0).max(120),
      }),
    ]),
  })
  .refine((value) => value.retention.mode === "count" || value.retention.daily + value.retention.weekly + value.retention.monthly > 0, {
    message: "Keep at least one daily, weekly, or monthly backup",
  });

interface FilenameParams {
  filename: string;
}

function validSchedule(cron: string, timezone: string): string | null {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    return `"${timezone}" isn't a time zone`;
  }
  try {
    new Cron(cron, { timezone, paused: true }).stop();
  } catch {
    return `"${cron}" isn't a valid schedule`;
  }
  return null;
}

/** Whether the backups would be lost along with the database's disk. */
async function sameDiskAsDatabase(ctx: BackupContext): Promise<boolean | null> {
  try {
    const [backups, data] = await Promise.all([stat(ctx.backupDir), stat(path.dirname(ctx.databasePath))]);
    return backups.dev === data.dev;
  } catch {
    return null;
  }
}

export interface BackupRouteOptions {
  ctx?: BackupContext;
  scheduler?: BackupScheduler;
}

// Admins only: backups hold every recipient's email address and the
// encrypted credentials.
export function registerBackupRoutes(app: FastifyInstance, db: Db, options: BackupRouteOptions): void {
  void app.register(async (scope) => {
    scope.addHook("preHandler", requireAuth(db, { read: "admin", write: "admin" }));

    function unavailable(reply: FastifyReply) {
      return reply.code(503).send({ error: "Backups aren't available on this server" });
    }

    async function overview(ctx: BackupContext) {
      const config = loadBackupSettings(ctx.db);
      return {
        backups: await listBackups(ctx.backupDir),
        settings: config,
        lastRun: loadLastRun(ctx.db),
        nextRun: nextBackupRun(config)?.toISOString() ?? null,
        location: {
          path: ctx.backupDir,
          fromEnv: Boolean(process.env.BACKUP_PATH),
          sameDiskAsDatabase: await sameDiskAsDatabase(ctx),
        },
      };
    }

    scope.get("/backups", async (_request, reply) => {
      if (!options.ctx) return unavailable(reply);
      return reply.send(await overview(options.ctx));
    });

    scope.post("/backups", async (request, reply) => {
      const ctx = options.ctx;
      if (!ctx) return unavailable(reply);
      try {
        const backup = await runBackup(ctx, "manual", request.log);
        return reply.code(201).send({ backup });
      } catch (err) {
        if (err instanceof BackupAlreadyRunningError) return reply.code(409).send({ error: err.message });
        const message = err instanceof Error ? err.message : String(err);
        return reply.code(500).send({ error: `The backup failed: ${message}` });
      }
    });

    scope.put("/backups/settings", async (request, reply) => {
      const ctx = options.ctx;
      if (!ctx) return unavailable(reply);
      const body = parseBody(settingsSchema, request.body, reply);
      if (!body) return reply;
      const problem = validSchedule(body.scheduleCron, body.timezone);
      if (problem) return reply.code(400).send({ error: problem });
      saveBackupSettings(ctx.db, body);
      options.scheduler?.refresh();
      request.log.info(
        { enabled: body.enabled, scheduleCron: body.scheduleCron, timezone: body.timezone, retention: body.retention },
        `Updated backup settings${body.enabled ? "" : ": scheduled backups are off"}`,
      );
      return reply.send(await overview(ctx));
    });

    scope.get<{ Params: FilenameParams }>("/backups/:filename/download", async (request, reply) => {
      const ctx = options.ctx;
      if (!ctx) return unavailable(reply);
      const found = await findBackup(ctx.backupDir, request.params.filename);
      if (!found) return reply.code(404).send({ error: "Not found" });
      const { filename } = found.file;
      request.log.warn({ filename }, `Downloaded the backup ${filename}`);
      return reply
        .header("content-disposition", `attachment; filename="${filename}"`)
        .header("cache-control", "no-store")
        .type("application/zip")
        .send(createReadStream(found.path));
    });

    scope.delete<{ Params: FilenameParams }>("/backups/:filename", async (request, reply) => {
      const ctx = options.ctx;
      if (!ctx) return unavailable(reply);
      const found = await findBackup(ctx.backupDir, request.params.filename);
      if (!found) return reply.code(404).send({ error: "Not found" });
      await rm(found.path, { force: true });
      request.log.warn({ filename: found.file.filename }, `Deleted the backup ${found.file.filename}`);
      return reply.code(204).send();
    });
  });
}
