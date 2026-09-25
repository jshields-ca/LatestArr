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
    // Every log line from an authenticated route records who did it.
    request.log = request.log.child({ user: user.email });
  };
}
