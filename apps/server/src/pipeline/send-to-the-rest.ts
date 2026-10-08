import { type Db, sendRunAttachments, sendRunRecipientResults, sendRuns } from "@latestarr/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { sendEmail, type EmailAttachment } from "../mailer/send.js";
import { htmlToPlainText } from "../render/plain-text.js";
import type { Logger } from "../logger.js";
import {
  loadNewsletter,
  loadSender,
  NewsletterNotFoundError,
  resolveRecipients,
  SendAlreadyRunningError,
} from "./run-newsletter.js";

// "Send to the rest" (#283): finishes a send that only reached some of its
// recipients, because LatestArr stopped partway (#280), the mail server
// turned some away, or a rate limit cut it off. It sends the same email
// (the stored HTML, subject, and embedded images) to only the people who
// didn't get it, and records them on the same send, so nobody gets a
// duplicate and History stays one entry per issue.
//
// Only the newsletter's latest send can be finished, and only while it's
// within the newsletter's lookback window: after a newer issue has gone
// out, or once the news is older than the window, finishing it would send
// people out-of-date news. Send now is the way to reach them then.

type SendRun = typeof sendRuns.$inferSelect;

export class SendRunNotFoundError extends Error {
  constructor() {
    super("Send not found");
    this.name = "SendRunNotFoundError";
  }
}

/** The send can't be finished; `message` says why, for the person asking. */
export class SendToRestUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SendToRestUnavailableError";
  }
}

export interface RestRecipient {
  id: string;
  email: string;
  displayName: string | null;
  /** "failed" when delivery to them failed; "not_sent" when it never got to them. */
  previous: "failed" | "not_sent";
}

export type RestPlan =
  | { available: true; recipients: RestRecipient[]; alreadySent: number }
  | { available: false; reason: string };

const FINISHABLE = ["partial_failure", "failed"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

async function loadRun(db: Db, newsletterId: string, runId: string): Promise<SendRun> {
  const [run] = await db.select().from(sendRuns).where(eq(sendRuns.id, runId));
  if (!run || run.newsletterId !== newsletterId) throw new SendRunNotFoundError();
  return run;
}

// Every embedded image the stored HTML refers to must still be stored, or
// the rest would get an email with broken images.
async function loadAttachments(db: Db, run: SendRun): Promise<EmailAttachment[] | null> {
  const rows = await db.select().from(sendRunAttachments).where(eq(sendRunAttachments.sendRunId, run.id));
  const stored = new Set(rows.map((row) => row.cid));
  const referenced = [...(run.renderedHtml ?? "").matchAll(/cid:([^"'\s)>]+)/g)].map((match) => match[1]!);
  if (referenced.some((cid) => !stored.has(cid))) return null;
  return rows.map(({ cid, filename, contentType, content }) => ({ cid, filename, contentType, content }));
}

/** Whether this send can be finished, and if so who it would go to. */
export async function planSendToTheRest(
  db: Db,
  newsletterId: string,
  runId: string,
  now: Date = new Date(),
): Promise<RestPlan> {
  const newsletter = await loadNewsletter(db, newsletterId).catch((err) => {
    throw err instanceof NewsletterNotFoundError ? new SendRunNotFoundError() : err;
  });
  const run = await loadRun(db, newsletterId, runId);
  const unavailable = (reason: string): RestPlan => ({ available: false, reason });

  if (run.status === "running") return unavailable("This send is still running.");
  if (!(FINISHABLE as readonly string[]).includes(run.status)) {
    return unavailable(
      run.status === "success" ? "Everyone already got this send." : "This send didn't go to anyone, so there's nothing to finish.",
    );
  }
  if (!run.renderedHtml || !run.subject || !run.startedAt) {
    return unavailable("This send was made by an earlier version of LatestArr, so it can't be finished. Use Send now instead.");
  }

  // A newer send that reached anyone (or is reaching them now) replaces it.
  // Newer by insertion order: start times are stored to the second, so two
  // quick sends can share one.
  const [newer] = await db
    .select({ id: sendRuns.id })
    .from(sendRuns)
    .where(
      and(
        eq(sendRuns.newsletterId, newsletterId),
        sql`${sendRuns}.rowid > (select rowid from ${sendRuns} where ${sendRuns.id} = ${run.id})`,
        sql`(${sendRuns.status} = 'running' or exists (select 1 from ${sendRunRecipientResults} where ${sendRunRecipientResults.sendRunId} = ${sendRuns.id} and ${sendRunRecipientResults.status} = 'sent'))`,
      ),
    )
    .limit(1);
  if (newer) {
    return unavailable("A newer issue has gone out since, so this one is out of date. Use Send now instead.");
  }

  const days = newsletter.lookbackDays;
  if (now.getTime() - run.startedAt.getTime() > days * DAY_MS) {
    return unavailable(
      `This send is more than ${days} day${days === 1 ? "" : "s"} old, the newsletter's lookback window, so its news is out of date. Use Send now instead.`,
    );
  }

  if ((await loadAttachments(db, run)) === null) {
    return unavailable("The images for this send are no longer stored, so it can't be finished. Use Send now instead.");
  }

  const results = await db
    .select({ recipientId: sendRunRecipientResults.recipientId, status: sendRunRecipientResults.status })
    .from(sendRunRecipientResults)
    .where(eq(sendRunRecipientResults.sendRunId, run.id));
  const sent = new Set(results.filter((result) => result.status === "sent").map((result) => result.recipientId));
  const failed = new Set(results.filter((result) => result.status !== "sent").map((result) => result.recipientId));

  // The newsletter's recipients as they are now: anyone deactivated since
  // is left out, and anyone added since is included.
  const rest = (await resolveRecipients(db, newsletterId))
    .filter((recipient) => recipient.isActive && !sent.has(recipient.id))
    .sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email))
    .map((recipient) => ({
      id: recipient.id,
      email: recipient.email,
      displayName: recipient.displayName,
      previous: failed.has(recipient.id) ? ("failed" as const) : ("not_sent" as const),
    }));
  if (rest.length === 0) return unavailable("Everyone this newsletter goes to already got this send.");
  return { available: true, recipients: rest, alreadySent: sent.size };
}

export interface SendToTheRestResult {
  status: "success" | "partial_failure" | "failed";
  sent: number;
  failed: number;
}

/**
 * Sends a partly sent send's email to the recipients it didn't reach,
 * recording them on the same send. Throws SendToRestUnavailableError when
 * it can't be finished, and SendAlreadyRunningError while another send of
 * the newsletter is running.
 */
export async function sendToTheRest(
  db: Db,
  newsletterId: string,
  runId: string,
  log: Logger,
  now: Date = new Date(),
): Promise<SendToTheRestResult> {
  const plan = await planSendToTheRest(db, newsletterId, runId, now);
  if (!plan.available) throw new SendToRestUnavailableError(plan.reason);
  const newsletter = await loadNewsletter(db, newsletterId);
  const sender = await loadSender(db, newsletter);
  const run = await loadRun(db, newsletterId, runId);
  const attachments = (await loadAttachments(db, run)) ?? [];

  // Marked running in one statement, only while no send of this newsletter
  // is running: it shares Send now's "already running" lock, and if
  // LatestArr stops partway, the startup clean-up (#280) closes it like any
  // interrupted send.
  const claimed = await db
    .update(sendRuns)
    .set({ status: "running", recipientCount: plan.alreadySent + plan.recipients.length })
    .where(
      and(
        eq(sendRuns.id, runId),
        inArray(sendRuns.status, [...FINISHABLE]),
        sql`not exists (select 1 from ${sendRuns} as other where other.newsletter_id = ${newsletterId} and other.status = 'running')`,
      ),
    )
    .returning({ id: sendRuns.id });
  if (claimed.length === 0) throw new SendAlreadyRunningError();

  const text = htmlToPlainText(run.renderedHtml!);
  const name = newsletter.name;
  log.info({ sendRunId: runId, recipients: plan.recipients.length }, `Sending "${name}" to the rest`);

  let sent = 0;
  let status: SendToTheRestResult["status"];
  try {
    for (const recipient of plan.recipients) {
      let outcome: { status: "sent" | "failed"; providerMessageId: string | null; error: string | null };
      try {
        const result = await sendEmail(sender.credentials, {
          from: sender.from,
          to: recipient.email,
          subject: run.subject!,
          html: run.renderedHtml!,
          text,
          attachments,
        });
        outcome = { status: "sent", providerMessageId: result.messageId, error: null };
        sent++;
      } catch (err) {
        log.warn({ err, recipientId: recipient.id }, `Couldn't deliver "${name}" to ${recipient.email}`);
        outcome = { status: "failed", providerMessageId: null, error: err instanceof Error ? err.message : "Unknown error" };
      }
      // One result per recipient per send: an earlier failure is replaced.
      await db
        .delete(sendRunRecipientResults)
        .where(and(eq(sendRunRecipientResults.sendRunId, runId), eq(sendRunRecipientResults.recipientId, recipient.id)));
      await db.insert(sendRunRecipientResults).values({ sendRunId: runId, recipientId: recipient.id, ...outcome });
    }
  } finally {
    // Also runs if something unexpected stops the loop, so the send isn't
    // left "running" and blocking the newsletter.
    const stillMissing = plan.recipients.length - sent;
    status = stillMissing === 0 ? "success" : plan.alreadySent + sent === 0 ? "failed" : "partial_failure";
    await db
      .update(sendRuns)
      .set({
        status,
        finishedAt: new Date(),
        restSentAt: new Date(),
        error:
          stillMissing === 0
            ? null
            : `${stillMissing} of ${plan.recipients.length} recipients still didn't get it after Send to the rest.`,
      })
      .where(eq(sendRuns.id, runId));
    log.info(
      { sendRunId: runId, status, sent, failed: stillMissing },
      `Sent "${name}" to the rest: ${sent} of ${plan.recipients.length} delivered`,
    );
  }

  return { status, sent, failed: plan.recipients.length - sent };
}
