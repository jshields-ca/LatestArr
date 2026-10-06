import { type Db, newsletters, sendRunRecipientResults, sendRuns } from "@latestarr/db";
import { and, eq, sql } from "drizzle-orm";
import type { Logger } from "../logger.js";
import { sendFailureAlert } from "../notifications/alerts.js";

// A send is recorded as "running" until it finishes. If LatestArr stops
// partway (a crash, a restart, an upgrade), nothing finishes it, and the
// "a send is already running" check would then refuse every later send of
// that newsletter (#280). So at startup, before catch-up, any run still
// "running" is closed as interrupted.
//
// Nothing is resent: everyone recorded as sent got it, and resending would
// give them a duplicate. Catch-up treats the interrupted send as this
// period's send (it has a start time), so it isn't sent again either. The
// admin is told who got it, and decides about the rest.

export async function closeInterruptedSends(db: Db, log: Logger): Promise<number> {
  const stuck = await db
    .select({ run: sendRuns, name: newsletters.name })
    .from(sendRuns)
    .innerJoin(newsletters, eq(sendRuns.newsletterId, newsletters.id))
    .where(eq(sendRuns.status, "running"));

  for (const { run, name } of stuck) {
    const [row] = await db
      .select({ sent: sql<number>`count(*)` })
      .from(sendRunRecipientResults)
      .where(and(eq(sendRunRecipientResults.sendRunId, run.id), eq(sendRunRecipientResults.status, "sent")));
    const sent = Number(row?.sent ?? 0);
    const total = run.recipientCount;
    const reached = total > 0 ? `${sent} of ${total} recipients` : `${sent} recipient${sent === 1 ? "" : "s"}`;
    const reason =
      `LatestArr stopped during this send, after reaching ${reached}. ` +
      (sent > 0
        ? "They're listed in its history. The rest didn't get it, and it won't be resent automatically, to avoid duplicates."
        : "Nobody got it, and it won't be resent automatically. Use Send now to send it.");
    const status = sent > 0 ? "partial_failure" : "failed";

    await db
      .update(sendRuns)
      .set({ status, finishedAt: new Date(), error: reason })
      .where(eq(sendRuns.id, run.id));
    log.warn({ newsletterId: run.newsletterId, sendRunId: run.id, sent, total }, `Send of "${name}" was interrupted: ${reason}`);
    await sendFailureAlert(
      db,
      {
        kind: status === "failed" ? "failed" : "partial_failure",
        newsletterId: run.newsletterId,
        newsletterName: name,
        trigger: "interrupted",
        reason,
        sendRunId: run.id,
      },
      log,
    );
  }
  return stuck.length;
}
