import { type Db, oidcIdentities, templates, users } from "@latestarr/db";
import { and, eq, ne, sql } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { hashPassword } from "../../auth/password.js";
import { deleteUserSessions, getSessionUser, SESSION_COOKIE } from "../../auth/session.js";
import { requireAuth } from "../require-auth.js";
import { parseBody } from "../validate.js";
import { MIN_PASSWORD_LENGTH } from "./auth.js";

// Everyone who can sign in is an admin for now; the role column already
// allows editor and viewer for when roles are enforced.

const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `The password must be at least ${MIN_PASSWORD_LENGTH} characters`);

// No password means the person signs in with SSO only.
const createUserSchema = z.object({
  email: z.email("A valid email is required"),
  displayName: z.string().trim().min(1, "A name is required"),
  password: passwordSchema.optional(),
});

const updateUserSchema = z.object({
  displayName: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
  // Sets a new temporary password, to be changed at the next sign-in.
  password: passwordSchema.optional(),
});

interface IdParams {
  id: string;
}

type User = typeof users.$inferSelect;

async function publicUser(db: Db, user: User) {
  const [sso] = await db.select({ id: oidcIdentities.id }).from(oidcIdentities).where(eq(oidcIdentities.userId, user.id)).limit(1);
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    hasPassword: Boolean(user.passwordHash),
    ssoLinked: Boolean(sso),
  };
}

async function signedInUser(db: Db, request: FastifyRequest) {
  const token = request.cookies[SESSION_COOKIE];
  return token ? getSessionUser(db, token) : null;
}

function requireAdmin(db: Db) {
  return async function requireAdminHook(request: FastifyRequest, reply: FastifyReply) {
    const user = await signedInUser(db, request);
    if (user?.role !== "admin") {
      return reply.code(403).send({ error: "Only admins can manage users" });
    }
  };
}

async function otherActiveAdmins(db: Db, excludingId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true), ne(users.id, excludingId)));
  return Number(row?.count ?? 0);
}

export function registerUserRoutes(app: FastifyInstance, db: Db): void {
  void app.register(async (scope) => {
    scope.addHook("preHandler", requireAuth(db));
    scope.addHook("preHandler", requireAdmin(db));

    scope.get("/users", async (_request, reply) => {
      const rows = await db.select().from(users).orderBy(users.createdAt);
      return reply.send({ users: await Promise.all(rows.map((user) => publicUser(db, user))) });
    });

    scope.post("/users", async (request, reply) => {
      const body = parseBody(createUserSchema, request.body, reply);
      if (!body) return reply;
      const email = body.email.trim().toLowerCase();
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.email})`, email));
      if (existing) {
        return reply.code(409).send({ error: "A user with that email already exists" });
      }
      const [user] = await db
        .insert(users)
        .values({
          email,
          displayName: body.displayName,
          role: "admin",
          passwordHash: body.password ? await hashPassword(body.password) : null,
          mustChangePassword: Boolean(body.password),
        })
        .returning();
      request.log.info({ targetUserId: user!.id }, `Added user ${email}`);
      return reply.code(201).send({ user: await publicUser(db, user!) });
    });

    scope.patch<{ Params: IdParams }>("/users/:id", async (request, reply) => {
      const body = parseBody(updateUserSchema, request.body, reply);
      if (!body) return reply;
      const me = await signedInUser(db, request);
      const [target] = await db.select().from(users).where(eq(users.id, request.params.id));
      if (!target) return reply.code(404).send({ error: "Not found" });

      if (body.isActive === false) {
        if (target.id === me?.id) {
          return reply.code(400).send({ error: "You can't deactivate your own account" });
        }
        if ((await otherActiveAdmins(db, target.id)) === 0) {
          return reply.code(400).send({ error: "There must always be at least one active admin" });
        }
      }

      const [updated] = await db
        .update(users)
        .set({
          ...(body.displayName !== undefined && { displayName: body.displayName }),
          ...(body.isActive !== undefined && { isActive: body.isActive }),
          ...(body.password !== undefined && {
            passwordHash: await hashPassword(body.password),
            mustChangePassword: true,
          }),
          updatedAt: new Date(),
        })
        .where(eq(users.id, target.id))
        .returning();

      // Deactivating or resetting a password signs them out everywhere,
      // except an admin resetting their own password stays signed in here.
      if (body.isActive === false || body.password !== undefined) {
        await deleteUserSessions(db, target.id, target.id === me?.id ? request.cookies[SESSION_COOKIE] : undefined);
      }
      const changes = [
        body.displayName !== undefined && "renamed",
        body.isActive === false && "deactivated",
        body.isActive === true && "reactivated",
        body.password !== undefined && "given a new temporary password",
      ].filter(Boolean);
      request.log.info({ targetUserId: target.id }, `User ${target.email} ${changes.join(", ") || "saved"}`);
      return reply.send({ user: await publicUser(db, updated!) });
    });

    scope.delete<{ Params: IdParams }>("/users/:id", async (request, reply) => {
      const me = await signedInUser(db, request);
      const [target] = await db.select().from(users).where(eq(users.id, request.params.id));
      if (!target) return reply.code(204).send();
      if (target.id === me?.id) {
        return reply.code(400).send({ error: "You can't delete your own account" });
      }
      if (target.isActive && (await otherActiveAdmins(db, target.id)) === 0) {
        return reply.code(400).send({ error: "There must always be at least one active admin" });
      }
      // Designs they created stay; they just lose the author.
      db.transaction((tx) => {
        tx.update(templates).set({ createdBy: null }).where(eq(templates.createdBy, target.id)).run();
        tx.delete(users).where(eq(users.id, target.id)).run();
      });
      request.log.info({ targetUserId: target.id }, `Deleted user ${target.email}`);
      return reply.code(204).send();
    });
  });
}
