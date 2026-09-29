import type { Db } from "@latestarr/db";
import type { FastifyReply, FastifyRequest } from "fastify";
import { getSessionUser, SESSION_COOKIE } from "../auth/session.js";

export function requireAuth(db: Db) {
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
    // Every log line from an authenticated route records who did it.
    request.log = request.log.child({ user: user.email });
  };
}
