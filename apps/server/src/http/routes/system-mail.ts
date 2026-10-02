import { type Db, smtpProfiles } from "@latestarr/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loadSystemMail, resetLinkOrigin, saveSystemMail } from "../../auth/password-reset.js";
import { requireAuth } from "../require-auth.js";
import { parseBody } from "../validate.js";

const systemMailSchema = z.object({
  smtpProfileId: z.string().min(1).nullable(),
});

// The SMTP profile LatestArr sends its own email through (password reset
// links). Admins only.
export function registerSystemMailRoutes(app: FastifyInstance, db: Db): void {
  void app.register(async (scope) => {
    scope.addHook("preHandler", requireAuth(db, { read: "admin", write: "admin" }));

    // Also says whether reset links work from here, and if not why, so the
    // page can tell the admin what to fix.
    function view(requestHost: string) {
      const link = resetLinkOrigin(db, requestHost);
      return {
        ...loadSystemMail(db),
        resetLinks: "origin" in link ? { available: true as const } : { available: false as const, reason: link.unavailable },
        webOrigin: process.env.WEB_ORIGIN ?? null,
      };
    }

    scope.get("/settings/system-mail", async (request, reply) => {
      return reply.send(view(request.host));
    });

    scope.put("/settings/system-mail", async (request, reply) => {
      const body = parseBody(systemMailSchema, request.body, reply);
      if (!body) return reply;
      let profileName: string | null = null;
      if (body.smtpProfileId) {
        const [profile] = await db
          .select({ name: smtpProfiles.name })
          .from(smtpProfiles)
          .where(eq(smtpProfiles.id, body.smtpProfileId));
        if (!profile) return reply.code(400).send({ error: "That SMTP profile doesn't exist" });
        profileName = profile.name;
      }
      saveSystemMail(db, { smtpProfileId: body.smtpProfileId });
      request.log.info(
        { smtpProfileId: body.smtpProfileId },
        profileName ? `System email now uses SMTP profile "${profileName}"` : "Turned off system email",
      );
      return reply.send(view(request.host));
    });
  });
}
