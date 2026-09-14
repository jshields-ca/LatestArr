import { type Db, users } from "@latestarr/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { hashPassword, verifyPassword } from "../../auth/password.js";
import { createSession, deleteSession, getSessionUser, SESSION_COOKIE } from "../../auth/session.js";

const MIN_PASSWORD_LENGTH = 12;

type SelectedUser = typeof users.$inferSelect;

function sanitizeUser(user: SelectedUser) {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

function stringHeader(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

interface BootstrapBody {
  email?: string;
  password?: string;
  displayName?: string;
}

interface LoginBody {
  email?: string;
  password?: string;
}

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

  app.post<{ Body: BootstrapBody }>(
    "/auth/bootstrap",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const existing = await db.select({ id: users.id }).from(users).limit(1);
      if (existing.length > 0) {
        return reply
          .code(403)
          .send({ error: "Bootstrap is only available when no users exist yet" });
      }

      const { email, password, displayName } = request.body ?? {};
      if (!email || !password || !displayName) {
        return reply.code(400).send({ error: "email, password, and displayName are required" });
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        return reply
          .code(400)
          .send({ error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      }

      const passwordHash = await hashPassword(password);
      const [user] = await db
        .insert(users)
        .values({ email, displayName, passwordHash, role: "admin" })
        .returning();

      return reply.code(201).send({ user: sanitizeUser(user!) });
    },
  );

  app.post<{ Body: LoginBody }>(
    "/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { email, password } = request.body ?? {};
      if (!email || !password) {
        return reply.code(400).send({ error: "email and password are required" });
      }

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
        // Browsers drop Secure cookies over plain HTTP, which would break local
        // dev (no TLS terminator in front of it); only require it in production,
        // where the app is expected to sit behind a TLS-terminating proxy.
        secure: process.env.NODE_ENV === "production",
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
}
