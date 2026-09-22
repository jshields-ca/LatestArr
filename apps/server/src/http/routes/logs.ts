import type { Db } from "@latestarr/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getRecentLogs } from "../../log-buffer.js";
import { requireAuth } from "../require-auth.js";

// Pino's numeric levels, for turning ?level=warn into the >= comparison
// getRecentLogs' callers actually want ("warn and anything worse"), and
// for giving the frontend a human label instead of a bare number.
const LEVEL_VALUES = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 } as const;
const LEVEL_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(LEVEL_VALUES).map(([name, value]) => [value, name]),
);

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  level: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).optional(),
});

export function registerLogRoutes(app: FastifyInstance, db: Db): void {
  void app.register(async (scope) => {
    scope.addHook("preHandler", requireAuth(db));

    scope.get("/logs", async (request, reply) => {
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid query" });
      }
      const { limit, level } = parsed.data;
      const minLevel = level ? LEVEL_VALUES[level] : undefined;

      const entries = getRecentLogs(500)
        .filter((entry) => minLevel === undefined || entry.level >= minLevel)
        .slice(0, limit ?? 200)
        .map((entry) => ({ ...entry, levelLabel: LEVEL_NAMES[entry.level] ?? "info" }));

      return reply.send({ logs: entries });
    });
  });
}
