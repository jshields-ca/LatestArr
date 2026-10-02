import type { Db, users } from "@latestarr/db";
import type { FastifyReply, FastifyRequest } from "fastify";
import { hasRole, ROLE_LABELS, type Role } from "../auth/roles.js";
import { getSessionUser, SESSION_COOKIE } from "../auth/session.js";

type User = typeof users.$inferSelect;

declare module "fastify" {
  interface FastifyContextConfig {
    /** The role this route needs, overriding its group's read/write role. */
    minRole?: Role;
  }
  interface FastifyRequest {
    /** The signed-in user, set by requireAuth. */
    sessionUser?: User;
  }
}

/** The role a route group needs to read (GET) and to change things. */
export interface Access {
  read: Role;
  write: Role;
}

const READ_METHODS = new Set(["GET", "HEAD"]);

export function requireAuth(db: Db, access: Access) {
  return async function requireAuthHook(request: FastifyRequest, reply: FastifyReply) {
    const token = request.cookies[SESSION_COOKIE];
    const user = token ? await getSessionUser(db, token) : null;
    if (!user) {
      return reply.code(401).send({ error: "Not authenticated" });
    }
    // Someone signed in with a temporary password can only choose a new
    // one (PATCH /auth/me) or sign out, not use the API around the web UI.
    if (user.mustChangePassword) {
      return reply
        .code(403)
        .send({ error: "Choose a new password before continuing", code: "password_change_required" });
    }
    const needed =
      request.routeOptions.config.minRole ?? (READ_METHODS.has(request.method) ? access.read : access.write);
    if (!hasRole(user.role, needed)) {
      request.log.warn(
        { user: user.email, role: user.role },
        `Refused ${request.method} ${request.routeOptions.url}: needs the ${ROLE_LABELS[needed]} role`,
      );
      return reply
        .code(403)
        .send({ error: `You need the ${ROLE_LABELS[needed]} role to do that`, code: "role_required", role: needed });
    }
    request.sessionUser = user;
    // Every log line from an authenticated route records who did it.
    request.log = request.log.child({ user: user.email });
  };
}
