import { type Db, newsletters, sendRuns } from "@latestarr/db";
import { Cron } from "croner";
import { desc, eq } from "drizzle-orm";
import { logger as defaultLogger, type Logger } from "../logger.js";
import { runNewsletter, type SendTrigger } from "../pipeline/run-newsletter.js";

export interface CronLike {
  stop(): void;
}

export type CronFactory = (
  pattern: string,
  options: { timezone: string },
  callback: () => void,
) => CronLike;

const defaultCronFactory: CronFactory = (pattern, options, callback) =>
  new Cron(pattern, options, callback);

export interface SchedulerHandle {
  jobs: Map<string, CronLike>;
}

export interface SchedulerOptions {
  cronFactory?: CronFactory;
  onError?: (newsletterId: string, err: unknown) => void;
  // Injectable for deterministic tests; defaults to the real clock.
  now?: () => Date;
  log?: Logger;
}

// runNewsletter already logs every failure, so there's nothing left to do
// by default — this hook only exists so a scheduled run failing never
// crashes the process (there's no request to propagate the error to).
function defaultOnError(): void {}

async function runScheduledNewsletter(
  db: Db,
  newsletterId: string,
  trigger: SendTrigger,
  options: SchedulerOptions,
): Promise<void> {
  try {
    await runNewsletter(db, newsletterId, { trigger, log: options.log });
  } catch (err) {
    (options.onError ?? defaultOnError)(newsletterId, err);
  }
}

export async function refreshScheduler(
  handle: SchedulerHandle,
  db: Db,
  options: SchedulerOptions = {},
): Promise<void> {
  const cronFactory = options.cronFactory ?? defaultCronFactory;
  const log = options.log ?? defaultLogger;

  for (const job of handle.jobs.values()) {
    job.stop();
  }
  handle.jobs.clear();

  const enabled = await db.select().from(newsletters).where(eq(newsletters.isEnabled, true));
  const schedule: { name: string; nextRun: string | null }[] = [];
  for (const newsletter of enabled) {
    // Returning the promise (rather than fire-and-forget `void`) is what lets
    // tests await a captured callback reference deterministically instead of
    // polling for completion.
    const job = cronFactory(newsletter.scheduleCron, { timezone: newsletter.timezone }, () =>
      runScheduledNewsletter(db, newsletter.id, "scheduled", options),
    );
    handle.jobs.set(newsletter.id, job);
    let nextRun: string | null = null;
    try {
      nextRun = nextScheduledRunAfter(newsletter.scheduleCron, newsletter.timezone, new Date())?.toISOString() ?? null;
    } catch {
      // Only feeds the log line below; never worth failing a refresh over.
    }
    schedule.push({ name: newsletter.name, nextRun });
  }

  const count = enabled.length;
  log.info({ schedule }, `Scheduler updated: ${count} enabled newsletter${count === 1 ? "" : "s"} scheduled`);
}

async function lastSendStartedAt(db: Db, newsletterId: string): Promise<Date | undefined> {
  const [row] = await db
    .select({ startedAt: sendRuns.startedAt })
    .from(sendRuns)
    .where(eq(sendRuns.newsletterId, newsletterId))
    .orderBy(desc(sendRuns.startedAt))
    .limit(1);
  return row?.startedAt ?? undefined;
}

// Pure schedule math: the next occurrence of `pattern` strictly after
// `since`, independent of whether a job with that pattern ever actually
// ran. `paused: true` means this never starts a real timer — it exists
// only to reuse croner's own cron-field parsing rather than reimplementing
// it, and is stopped immediately after the one synchronous read.
function nextScheduledRunAfter(pattern: string, timezone: string, since: Date): Date | null {
  const job = new Cron(pattern, { timezone, paused: true });
  const next = job.nextRun(since);
  job.stop();
  return next;
}

// Catches up newsletters whose schedule fired while the process was down
// (the container was stopped, crashed, or redeployed across a scheduled
// time) — croner's in-process timers only fire while running, so a missed
// occurrence otherwise just never happens, silently. Runs once per missed
// newsletter regardless of how many occurrences were missed, since a
// digest's content is "recently added within the lookback window" rather
// than tied to a specific historical occurrence — backfilling once catches
// the recipient up, and sending once per missed week would just be noise.
// Intentionally only called from startScheduler (server boot), not
// refreshScheduler (which also runs on every newsletter create/update) —
// this models "was the process down," not "did a save happen."
async function runMissedNewsletters(db: Db, options: SchedulerOptions): Promise<void> {
  const now = (options.now ?? (() => new Date()))();
  const log = options.log ?? defaultLogger;

  const enabled = await db.select().from(newsletters).where(eq(newsletters.isEnabled, true));
  for (const newsletter of enabled) {
    const since = (await lastSendStartedAt(db, newsletter.id)) ?? newsletter.createdAt;
    const missedAt = nextScheduledRunAfter(newsletter.scheduleCron, newsletter.timezone, since);
    if (missedAt && missedAt <= now) {
      log.info(
        { newsletterId: newsletter.id, missedAt: missedAt.toISOString() },
        `Catching up "${newsletter.name}": its scheduled send was missed while LatestArr wasn't running`,
      );
      await runScheduledNewsletter(db, newsletter.id, "catch-up", options);
    }
  }
}

export async function startScheduler(
  db: Db,
  options: SchedulerOptions = {},
): Promise<SchedulerHandle> {
  const handle: SchedulerHandle = { jobs: new Map() };
  await refreshScheduler(handle, db, options);
  await runMissedNewsletters(db, options);
  return handle;
}

export function stopScheduler(handle: SchedulerHandle): void {
  for (const job of handle.jobs.values()) {
    job.stop();
  }
  handle.jobs.clear();
}
