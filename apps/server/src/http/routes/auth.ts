import { type Db, users } from "@latestarr/db";
import { eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hashPassword, verifyDummyPassword, verifyPassword } from "../../auth/password.js";
import {
  clearResetTokens,
  consumeResetToken,
  createResetToken,
  recentlySent,
  resetLinkOrigin,
  sendResetEmail,
} from "../../auth/password-reset.js";
import {
  createSession,
  deleteSession,
  deleteUserSessions,
  getSessionUser,
  SESSION_COOKIE,
} from "../../auth/session.js";
import { parseBody } from "../validate.js";

export const MIN_PASSWORD_LENGTH = 12;

type SelectedUser = typeof users.$inferSelect;

function sanitizeUser(user: SelectedUser) {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

function stringHeader(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

const bootstrapSchema = z.object({
  email: z.email("email, password, and displayName are required"),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `password must be at least ${MIN_PASSWORD_LENGTH} characters`),
  displayName: z.string().trim().min(1, "email, password, and displayName are required"),
});

const loginSchema = z.object({
  email: z.email("email and password are required"),
  password: z.string().min(1, "email and password are required"),
});

const updateMeSchema = z.object({
  displayName: z.string().trim().min(1).optional(),
  currentPassword: z.string().min(1).optional(),
  newPassword: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `newPassword must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .optional(),
});

const resetRequestSchema = z.object({
  email: z.email("Enter your email address"),
});

const resetConfirmSchema = z.object({
  token: z.string().min(1, "This reset link isn't complete. Open it from the email again."),
  newPassword: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `The password must be at least ${MIN_PASSWORD_LENGTH} characters`),
});

// The same answer whether or not the account exists, so the form can't be
// used to find out who has one.
const RESET_REQUESTED = {
  message: "If that email belongs to an account that can use a reset link, we've sent one. It works for 30 minutes.",
};

export interface AuthRouteOptions {
  oidcEnabled: boolean;
}

export function registerAuthRoutes(
  app: FastifyInstance,
  db: Db,
  options: AuthRouteOptions = { oidcEnabled: false },
): void {
  app.get("/auth/providers", async (request, reply) => {
    const existing = await db.select({ id: users.id }).from(users).limit(1);
    return reply.send({
      local: true,
      oidc: options.oidcEnabled,
      needsSetup: existing.length === 0,
      // Whether "Forgot password?" can email a link from here.
      passwordReset: "origin" in resetLinkOrigin(db, request.host),
    });
  });

  // Emails a reset link when the account exists, is active, has a password,
  // and wasn't sent one in the last couple of minutes. The reply never says
  // which, and the email is sent after replying, so timing doesn't either.
  app.post(
    "/auth/password-reset/request",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const body = parseBody(resetRequestSchema, request.body, reply);
      if (!body) return reply;
      const email = body.email.trim().toLowerCase();

      const link = resetLinkOrigin(db, request.host);
      if (!("origin" in link)) {
        const why =
          link.unavailable === "no_system_mail"
            ? "no SMTP profile is chosen for system email"
            : `WEB_ORIGIN (${process.env.WEB_ORIGIN ?? "not set"}) doesn't match the address it was asked from (${request.host}), so the link would be broken`;
        request.log.warn({ ip: request.ip }, `Didn't send a password reset link for ${email}: ${why}`);
        return reply.code(202).send(RESET_REQUESTED);
      }

      const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email));
      if (!user || !user.isActive || !user.passwordHash) {
        request.log.info({ ip: request.ip }, `Password reset asked for ${email}, which has no account that can use one`);
        return reply.code(202).send(RESET_REQUESTED);
      }
      if (recentlySent(db, user.id)) {
        request.log.info({ ip: request.ip, userId: user.id }, `Password reset asked again for ${email}; a link was sent moments ago`);
        return reply.code(202).send(RESET_REQUESTED);
      }

      const token = createResetToken(db, user.id);
      request.log.info({ ip: request.ip, userId: user.id }, `Password reset asked for ${email}`);
      void sendResetEmail(db, user, token, link.origin, request.log);
      return reply.code(202).send(RESET_REQUESTED);
    },
  );

  // Sets a new password from a reset link, signs the account out everywhere,
  // and leaves signing in to the person (with the new password).
  app.post(
    "/auth/password-reset/confirm",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = parseBody(resetConfirmSchema, request.body, reply);
      if (!body) return reply;
      const passwordHash = await hashPassword(body.newPassword);
      const userId = consumeResetToken(db, body.token);
      const [user] = userId ? await db.select().from(users).where(eq(users.id, userId)) : [];
      if (!user || !user.isActive || !user.passwordHash) {
        request.log.warn({ ip: request.ip }, "A password reset link was used that had expired or was already used");
        return reply.code(400).send({ error: "This reset link has expired or was already used. Ask for a new one." });
      }
      await db
        .update(users)
        .set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
        .where(eq(users.id, user.id));
      await deleteUserSessions(db, user.id);
      clearResetTokens(db, user.id);
      request.log.info({ ip: request.ip, userId: user.id }, `${user.email} reset their password with an email link`);
      return reply.code(204).send();
    },
  );

  app.post(
    "/auth/bootstrap",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const existing = await db.select({ id: users.id }).from(users).limit(1);
      if (existing.length > 0) {
        return reply
          .code(403)
          .send({ error: "Bootstrap is only available when no users exist yet" });
      }

      const body = parseBody(bootstrapSchema, request.body, reply);
      if (!body) return reply;
      const { email, password, displayName } = body;

      const passwordHash = await hashPassword(password);
      // Checked again inside one transaction with the insert: two
      // bootstrap requests racing through the check above (hashing takes a
      // while) must not both create an admin.
      const user = db.transaction((tx) => {
        if (tx.select({ id: users.id }).from(users).limit(1).all().length > 0) return undefined;
        return tx.insert(users).values({ email, displayName, passwordHash, role: "admin" }).returning().get();
      });
      if (!user) {
        return reply.code(403).send({ error: "Bootstrap is only available when no users exist yet" });
      }

      request.log.info({ userId: user.id }, `Created the admin account ${email}`);
      return reply.code(201).send({ user: sanitizeUser(user) });
    },
  );

  app.post(
    "/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = parseBody(loginSchema, request.body, reply);
      if (!body) return reply;
      const { email, password } = body;

      // Email addresses match regardless of case.
      const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email.trim().toLowerCase()));
      if (!user || !user.passwordHash || !user.isActive) {
        await verifyDummyPassword(password);
        request.log.warn({ ip: request.ip }, `Failed sign-in attempt for ${email}`);
        return reply.code(401).send({ error: "Invalid email or password" });
      }

      const valid = await verifyPassword(user.passwordHash, password);
      if (!valid) {
        request.log.warn({ ip: request.ip }, `Failed sign-in attempt for ${email}`);
        return reply.code(401).send({ error: "Invalid email or password" });
      }

      const session = await createSession(db, user.id, {
        ip: request.ip,
        userAgent: stringHeader(request.headers["user-agent"]),
      });

      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

      reply.setCookie(SESSION_COOKIE, session.token, {
        httpOnly: true,
        // Browsers silently drop Secure cookies set over plain HTTP — this
        // has to reflect the actual connection (direct HTTP, or HTTPS via a
        // reverse proxy that set TRUST_PROXY=true and forwards
        // X-Forwarded-Proto), not NODE_ENV. The Docker image always sets
        // NODE_ENV=production regardless of whether TLS is in front of it,
        // so keying off that unconditionally forced Secure on even for the
        // documented plain-http:// Getting Started flow, silently breaking
        // login (the cookie was set but never stored by the browser).
        secure: request.protocol === "https",
        sameSite: "lax",
        path: "/",
        expires: session.expiresAt,
      });

      request.log.info({ userId: user.id, ip: request.ip }, `${user.email} signed in`);
      return reply.send({ user: sanitizeUser(user) });
    },
  );

  app.post("/auth/logout", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) {
      const user = await getSessionUser(db, token);
      await deleteSession(db, token);
      if (user) {
        request.log.info({ userId: user.id }, `${user.email} signed out`);
      }
    }
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.code(204).send();
  });

  app.get("/auth/me", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (!token) {
      return reply.code(401).send({ error: "Not authenticated" });
    }

    const user = await getSessionUser(db, token);
    if (!user) {
      return reply.code(401).send({ error: "Not authenticated" });
    }

    return reply.send({ user: sanitizeUser(user) });
  });

  app.patch("/auth/me", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (!token) {
      return reply.code(401).send({ error: "Not authenticated" });
    }
    const currentUser = await getSessionUser(db, token);
    if (!currentUser) {
      return reply.code(401).send({ error: "Not authenticated" });
    }

    const body = parseBody(updateMeSchema, request.body, reply);
    if (!body) return reply;
    const { displayName, currentPassword, newPassword } = body;

    const updates: { displayName?: string; passwordHash?: string; mustChangePassword?: boolean } = {};

    if (displayName !== undefined) {
      updates.displayName = displayName;
    }

    if (currentPassword !== undefined || newPassword !== undefined) {
      if (!currentPassword || !newPassword) {
        return reply
          .code(400)
          .send({ error: "currentPassword and newPassword are both required to change the password" });
      }
      if (!currentUser.passwordHash) {
        return reply
          .code(400)
          .send({ error: "This account signs in via SSO and has no local password to change" });
      }
      const valid = await verifyPassword(currentUser.passwordHash, currentPassword);
      if (!valid) {
        request.log.warn({ userId: currentUser.id }, `Password change for ${currentUser.email} rejected: current password was incorrect`);
        return reply.code(401).send({ error: "Current password is incorrect" });
      }
      if (newPassword === currentPassword) {
        return reply.code(400).send({ error: "Choose a new password that's different from the current one" });
      }
      updates.passwordHash = await hashPassword(newPassword);
      updates.mustChangePassword = false;
    }

    if (Object.keys(updates).length === 0) {
      return reply.send({ user: sanitizeUser(currentUser) });
    }

    const [updated] = await db.update(users).set(updates).where(eq(users.id, currentUser.id)).returning();
    // A new password signs out every other session, e.g. one opened with a
    // temporary password, and cancels any reset link.
    if (updates.passwordHash) {
      await deleteUserSessions(db, currentUser.id, token);
      clearResetTokens(db, currentUser.id);
    }
    const changed = [updates.displayName !== undefined && "display name", updates.passwordHash && "password"].filter(Boolean);
    request.log.info({ userId: currentUser.id }, `${currentUser.email} changed their ${changed.join(" and ")}`);

    return reply.send({ user: sanitizeUser(updated!) });
  });
}
