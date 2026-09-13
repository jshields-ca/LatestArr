import { type Db, newsletters } from "@latestarr/db";
import { Cron } from "croner";
import { eq } from "drizzle-orm";
import { runNewsletter } from "../pipeline/run-newsletter.js";

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
}

function defaultOnError(newsletterId: string, err: unknown): void {
  // A scheduled run failing must never crash the process — unlike the
  // manual /send-now route, there's no request to propagate the error to.
  console.error(`Scheduled send failed for newsletter ${newsletterId}:`, err);
}

async function runScheduledNewsletter(
  db: Db,
  newsletterId: string,
  onError: (newsletterId: string, err: unknown) => void,
): Promise<void> {
  try {
    await runNewsletter(db, newsletterId);
  } catch (err) {
    onError(newsletterId, err);
  }
}

export async function refreshScheduler(
  handle: SchedulerHandle,
  db: Db,
  options: SchedulerOptions = {},
): Promise<void> {
  const cronFactory = options.cronFactory ?? defaultCronFactory;
  const onError = options.onError ?? defaultOnError;

  for (const job of handle.jobs.values()) {
    job.stop();
  }
  handle.jobs.clear();

  const enabled = await db.select().from(newsletters).where(eq(newsletters.isEnabled, true));
  for (const newsletter of enabled) {
    // Returning the promise (rather than fire-and-forget `void`) is what lets
    // tests await a captured callback reference deterministically instead of
    // polling for completion.
    const job = cronFactory(newsletter.scheduleCron, { timezone: newsletter.timezone }, () =>
      runScheduledNewsletter(db, newsletter.id, onError),
    );
    handle.jobs.set(newsletter.id, job);
  }
}

export async function startScheduler(
  db: Db,
  options: SchedulerOptions = {},
): Promise<SchedulerHandle> {
  const handle: SchedulerHandle = { jobs: new Map() };
  await refreshScheduler(handle, db, options);
  return handle;
}

export function stopScheduler(handle: SchedulerHandle): void {
  for (const job of handle.jobs.values()) {
    job.stop();
  }
  handle.jobs.clear();
}
