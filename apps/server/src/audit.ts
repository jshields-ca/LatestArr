import { auditEvents, type Db } from "@latestarr/db";
import { desc } from "drizzle-orm";
import type { LogEntry } from "./log-buffer.js";

/**
 * Records a security event in the database. For things that happen outside
 * the server process (the recovery command), whose log lines would never
 * reach the Logs page's in-memory buffer.
 */
export function recordAuditEvent(
  db: Db,
  message: string,
  detail: Record<string, unknown> = {},
  level: 30 | 40 = 40,
): void {
  db.insert(auditEvents).values({ message, detail, level }).run();
}

/** The latest audit events, newest first, shaped like log entries. */
export function recentAuditEvents(db: Db, limit: number): LogEntry[] {
  return db
    .select()
    .from(auditEvents)
    .orderBy(desc(auditEvents.time))
    .limit(limit)
    .all()
    .map((event) => ({ ...event.detail, time: event.time.getTime(), level: event.level, msg: event.message }));
}
