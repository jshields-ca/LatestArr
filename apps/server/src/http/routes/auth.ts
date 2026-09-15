import { type Db, users } from "@latestarr/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../../auth/password.js";
import { createSession, deleteSession, getSessionUser, SESSION_COOKIE } from "../../auth/session.js";
import { parseBody } from "../validate.js";

const MIN_PASSWORD_LENGTH = 12;

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

export interface AuthRouteOptions {
  oidcEnabled: boolean;
}

export function registerAuthRoutes(
  app: FastifyInstance,
  db: Db,
  options: AuthRouteOptions = { oidcEnabled: false },
): void {
  app.get("/auth/providers", async (_request, reply) => {
    const existing = await db.select({ id: users.id }).from(users).limit(1);
    return reply.send({
      local: true,
      oidc: options.oidcEnabled,
      needsSetup: existing.length === 0,
    });
  });

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
      const [user] = await db
        .insert(users)
        .values({ email, displayName, passwordHash, role: "admin" })
        .returning();

      return reply.code(201).send({ user: sanitizeUser(user!) });
    },
  );

  app.post(
    "/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = parseBody(loginSchema, request.body, reply);
      if (!body) return reply;
      const { email, password } = body;

      const [user] = await db.select().from(users).where(eq(users.email, email));
      if (!user || !user.passwordHash || !user.isActive) {
        return reply.code(401).send({ error: "Invalid email or password" });
      }

      const valid = await verifyPassword(user.passwordHash, password);
      if (!valid) {
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

      return reply.send({ user: sanitizeUser(user) });
    },
  );

  app.post("/auth/logout", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) {
      await deleteSession(db, token);
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

    const updates: { displayName?: string; passwordHash?: string } = {};

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
        return reply.code(401).send({ error: "Current password is incorrect" });
      }
      updates.passwordHash = await hashPassword(newPassword);
    }

    if (Object.keys(updates).length === 0) {
      return reply.send({ user: sanitizeUser(currentUser) });
    }

    const [updated] = await db.update(users).set(updates).where(eq(users.id, currentUser.id)).returning();

    return reply.send({ user: sanitizeUser(updated!) });
  });
}
