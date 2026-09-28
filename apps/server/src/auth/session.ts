import { createHash, randomBytes } from "node:crypto";
import { type Db, sessions, users } from "@latestarr/db";
import { eq } from "drizzle-orm";

export const SESSION_COOKIE = "latestarr_session";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

export interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

export async function createSession(
  db: Db,
  userId: string,
  meta: SessionMeta = {},
): Promise<CreatedSession> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return { token, expiresAt };
}

export async function getSessionUser(db: Db, token: string) {
  const id = hashToken(token);
  const [row] = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, id));

  if (!row) return null;

  // A deactivated account's sessions stop working at once, not when they
  // expire.
  if (row.expiresAt.getTime() < Date.now() || !row.user.isActive) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }

  return row.user;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

// Signs a user out everywhere, e.g. when an admin deactivates them or
// resets their password. `exceptToken` keeps the caller's own session.
export async function deleteUserSessions(db: Db, userId: string, exceptToken?: string): Promise<void> {
  const keep = exceptToken ? hashToken(exceptToken) : undefined;
  const rows = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId));
  for (const row of rows) {
    if (row.id !== keep) await db.delete(sessions).where(eq(sessions.id, row.id));
  }
}
