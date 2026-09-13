import { decrypt, encrypt } from "@latestarr/crypto";
import { type Db, smtpProfiles } from "@latestarr/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { sendEmail, verifySmtpConnection } from "../../mailer/send.js";
import { getEncryptionKey } from "../../secrets.js";
import { requireAuth } from "../require-auth.js";

type SelectedSmtpProfile = typeof smtpProfiles.$inferSelect;

function sanitize(row: SelectedSmtpProfile) {
  const { authUserEncrypted: _u, authPassEncrypted: _p, ...safe } = row;
  return { ...safe, hasAuth: Boolean(row.authUserEncrypted) };
}

function decryptOptional(value: string | null): string | undefined {
  return value ? decrypt(value, getEncryptionKey()) : undefined;
}

function credentialsFor(row: SelectedSmtpProfile) {
  return {
    host: row.host,
    port: row.port,
    secure: row.secure,
    user: decryptOptional(row.authUserEncrypted),
    pass: decryptOptional(row.authPassEncrypted),
  };
}

interface CreateSmtpProfileBody {
  name?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;
  defaultFromName?: string;
  defaultFromEmail?: string;
}

interface UpdateSmtpProfileBody {
  name?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;
  defaultFromName?: string;
  defaultFromEmail?: string;
}

interface IdParams {
  id: string;
}

interface SendTestBody {
  to?: string;
}

export function registerSmtpProfileRoutes(app: FastifyInstance, db: Db): void {
  void app.register(async (scope) => {
    scope.addHook("preHandler", requireAuth(db));

    scope.post<{ Body: CreateSmtpProfileBody }>("/smtp-profiles", async (request, reply) => {
      const { name, host, port, secure, username, password, defaultFromName, defaultFromEmail } =
        request.body ?? {};
      if (!name || !host || !port || !defaultFromName || !defaultFromEmail) {
        return reply.code(400).send({
          error: "name, host, port, defaultFromName, and defaultFromEmail are required",
        });
      }

      const key = getEncryptionKey();
      const [profile] = await db
        .insert(smtpProfiles)
        .values({
          name,
          host,
          port,
          secure: secure ?? true,
          authUserEncrypted: username ? encrypt(username, key) : null,
          authPassEncrypted: password ? encrypt(password, key) : null,
          defaultFromName,
          defaultFromEmail,
        })
        .returning();

      return reply.code(201).send({ smtpProfile: sanitize(profile!) });
    });

    scope.get("/smtp-profiles", async (_request, reply) => {
      const rows = await db.select().from(smtpProfiles);
      return reply.send({ smtpProfiles: rows.map(sanitize) });
    });

    scope.get<{ Params: IdParams }>("/smtp-profiles/:id", async (request, reply) => {
      const [profile] = await db
        .select()
        .from(smtpProfiles)
        .where(eq(smtpProfiles.id, request.params.id));
      if (!profile) {
        return reply.code(404).send({ error: "Not found" });
      }
      return reply.send({ smtpProfile: sanitize(profile) });
    });

    scope.patch<{ Params: IdParams; Body: UpdateSmtpProfileBody }>(
      "/smtp-profiles/:id",
      async (request, reply) => {
        const { name, host, port, secure, username, password, defaultFromName, defaultFromEmail } =
          request.body ?? {};
        const key = getEncryptionKey();

        const [profile] = await db
          .update(smtpProfiles)
          .set({
            ...(name !== undefined && { name }),
            ...(host !== undefined && { host }),
            ...(port !== undefined && { port }),
            ...(secure !== undefined && { secure }),
            ...(username !== undefined && { authUserEncrypted: encrypt(username, key) }),
            ...(password !== undefined && { authPassEncrypted: encrypt(password, key) }),
            ...(defaultFromName !== undefined && { defaultFromName }),
            ...(defaultFromEmail !== undefined && { defaultFromEmail }),
          })
          .where(eq(smtpProfiles.id, request.params.id))
          .returning();

        if (!profile) {
          return reply.code(404).send({ error: "Not found" });
        }
        return reply.send({ smtpProfile: sanitize(profile) });
      },
    );

    scope.delete<{ Params: IdParams }>("/smtp-profiles/:id", async (request, reply) => {
      await db.delete(smtpProfiles).where(eq(smtpProfiles.id, request.params.id));
      return reply.code(204).send();
    });

    scope.post<{ Params: IdParams }>("/smtp-profiles/:id/test", async (request, reply) => {
      const [profile] = await db
        .select()
        .from(smtpProfiles)
        .where(eq(smtpProfiles.id, request.params.id));
      if (!profile) {
        return reply.code(404).send({ error: "Not found" });
      }

      try {
        await verifySmtpConnection(credentialsFor(profile));
        return reply.send({ ok: true });
      } catch (err) {
        return reply.send({ ok: false, message: err instanceof Error ? err.message : "Unknown error" });
      }
    });

    scope.post<{ Params: IdParams; Body: SendTestBody }>(
      "/smtp-profiles/:id/send-test",
      async (request, reply) => {
        const { to } = request.body ?? {};
        if (!to) {
          return reply.code(400).send({ error: "to is required" });
        }

        const [profile] = await db
          .select()
          .from(smtpProfiles)
          .where(eq(smtpProfiles.id, request.params.id));
        if (!profile) {
          return reply.code(404).send({ error: "Not found" });
        }

        try {
          const result = await sendEmail(credentialsFor(profile), {
            from: `${profile.defaultFromName} <${profile.defaultFromEmail}>`,
            to,
            subject: "LatestArr test email",
            html: "<p>This is a test email from LatestArr.</p>",
            text: "This is a test email from LatestArr.",
          });
          return reply.send({ ok: true, messageId: result.messageId });
        } catch (err) {
          return reply.send({ ok: false, message: err instanceof Error ? err.message : "Unknown error" });
        }
      },
    );
  });
}
