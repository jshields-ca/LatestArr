import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, newsletters, runMigrations, sendRuns, type Db } from "@latestarr/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearLogBuffer, getRecentLogs } from "../log-buffer.js";
import {
  refreshScheduler,
  startScheduler,
  stopScheduler,
  type CronFactory,
} from "./engine.js";

interface RecordedJob {
  pattern: string;
  timezone: string;
  callback: () => unknown;
  stop: ReturnType<typeof vi.fn>;
}

let dir: string;
let db: Db;
let recordedJobs: RecordedJob[];
let fakeCronFactory: CronFactory;

beforeEach(() => {
  process.env.ENCRYPTION_KEY = "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=";
  dir = mkdtempSync(path.join(tmpdir(), "latestarr-scheduler-test-"));
  db = createDb(path.join(dir, "test.db"));
  runMigrations(db);

  recordedJobs = [];
  fakeCronFactory = (pattern, options, callback) => {
    const stop = vi.fn();
    recordedJobs.push({ pattern, timezone: options.timezone, callback, stop });
    return { stop };
  };
});

afterEach(() => {
  db.$client.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  delete process.env.ENCRYPTION_KEY;
});

async function createNewsletter(overrides: { isEnabled?: boolean; scheduleCron?: string } = {}) {
  const [newsletter] = await db
    .insert(newsletters)
    .values({
      name: "Weekly Digest",
      scheduleCron: overrides.scheduleCron ?? "0 9 * * 1",
      ...(overrides.isEnabled !== undefined && { isEnabled: overrides.isEnabled }),
    })
    .returning();
  return newsletter!;
}

describe("startScheduler", () => {
  it("registers one job per enabled newsletter", async () => {
    await createNewsletter({ scheduleCron: "0 9 * * 1" });
    await createNewsletter({ scheduleCron: "0 10 * * 2" });

    const handle = await startScheduler(db, { cronFactory: fakeCronFactory });

    expect(handle.jobs.size).toBe(2);
    expect(recordedJobs).toHaveLength(2);
    expect(recordedJobs.map((j) => j.pattern).sort()).toEqual(["0 10 * * 2", "0 9 * * 1"]);
  });

  it("skips disabled newsletters", async () => {
    await createNewsletter({ isEnabled: true });
    await createNewsletter({ isEnabled: false });

    const handle = await startScheduler(db, { cronFactory: fakeCronFactory });

    expect(handle.jobs.size).toBe(1);
  });

  it("does not crash with zero newsletters", async () => {
    const handle = await startScheduler(db, { cronFactory: fakeCronFactory });
    expect(handle.jobs.size).toBe(0);
  });

  it("passes the newsletter's timezone through to the cron factory", async () => {
    await db.insert(newsletters).values({
      name: "Tokyo Digest",
      scheduleCron: "0 9 * * 1",
      timezone: "Asia/Tokyo",
    });

    await startScheduler(db, { cronFactory: fakeCronFactory });

    expect(recordedJobs[0]?.timezone).toBe("Asia/Tokyo");
  });
});

describe("refreshScheduler", () => {
  it("stops previous jobs and re-registers from current DB state", async () => {
    const newsletter = await createNewsletter({ isEnabled: true });
    const handle = await startScheduler(db, { cronFactory: fakeCronFactory });
    const firstJobStop = recordedJobs[0]!.stop;

    await db.update(newsletters).set({ isEnabled: false }).where(eq(newsletters.id, newsletter.id));
    await refreshScheduler(handle, db, { cronFactory: fakeCronFactory });

    expect(firstJobStop).toHaveBeenCalled();
    expect(handle.jobs.size).toBe(0);
  });

  it("picks up a newly created newsletter", async () => {
    const handle = await startScheduler(db, { cronFactory: fakeCronFactory });
    expect(handle.jobs.size).toBe(0);

    await createNewsletter();
    await refreshScheduler(handle, db, { cronFactory: fakeCronFactory });

    expect(handle.jobs.size).toBe(1);
  });
});

describe("stopScheduler", () => {
  it("stops every job and clears the handle", async () => {
    await createNewsletter();
    await createNewsletter();
    const handle = await startScheduler(db, { cronFactory: fakeCronFactory });

    stopScheduler(handle);

    expect(handle.jobs.size).toBe(0);
    for (const job of recordedJobs) {
      expect(job.stop).toHaveBeenCalled();
    }
  });
});

describe("missed-schedule catch-up", () => {
  // "0 9 * * 1" is every Monday 09:00 UTC; 2024-01-01 was itself a Monday,
  // so occurrences fall on 2024-01-01, -08, -15, 09:00 UTC.
  const scheduleCron = "0 9 * * 1";

  it("runs a newsletter whose scheduled fire was missed while the process was down", async () => {
    const newsletter = await createNewsletter({ scheduleCron });
    await db
      .update(newsletters)
      .set({ createdAt: new Date("2024-01-01T00:00:00Z") })
      .where(eq(newsletters.id, newsletter.id));
    const onError = vi.fn();

    await startScheduler(db, {
      cronFactory: fakeCronFactory,
      onError,
      now: () => new Date("2024-01-02T00:00:00Z"),
    });

    // No SMTP profile configured, so the catch-up run fails the same way
    // the "scheduled callback" test's normal fire does — onError being
    // called at all is what proves runNewsletter actually executed.
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0]).toBe(newsletter.id);
  });

  it("does not re-run a newsletter that already sent since its last scheduled fire", async () => {
    const newsletter = await createNewsletter({ scheduleCron });
    await db
      .update(newsletters)
      .set({ createdAt: new Date("2024-01-01T00:00:00Z") })
      .where(eq(newsletters.id, newsletter.id));
    await db.insert(sendRuns).values({
      newsletterId: newsletter.id,
      status: "success",
      startedAt: new Date("2024-01-01T09:05:00Z"),
    });
    const onError = vi.fn();

    await startScheduler(db, {
      cronFactory: fakeCronFactory,
      onError,
      now: () => new Date("2024-01-02T00:00:00Z"),
    });

    expect(onError).not.toHaveBeenCalled();
  });

  it("does not run a newsletter whose first scheduled fire hasn't happened yet", async () => {
    const newsletter = await createNewsletter({ scheduleCron });
    await db
      .update(newsletters)
      .set({ createdAt: new Date("2024-01-01T00:00:00Z") })
      .where(eq(newsletters.id, newsletter.id));
    const onError = vi.fn();

    await startScheduler(db, {
      cronFactory: fakeCronFactory,
      onError,
      // "now" is before the newsletter's first scheduled occurrence.
      now: () => new Date("2024-01-01T00:00:00Z"),
    });

    expect(onError).not.toHaveBeenCalled();
  });
});

describe("scheduled callback", () => {
  it("invokes runNewsletter and swallows a failure via onError", async () => {
    // No SMTP profile configured, so runNewsletter rejects with
    // NewsletterMisconfiguredError — this is exactly the case a scheduled
    // (not manually triggered) run must not let crash the process.
    const newsletter = await createNewsletter();
    const onError = vi.fn();

    await startScheduler(db, { cronFactory: fakeCronFactory, onError });

    await recordedJobs[0]!.callback();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0]).toBe(newsletter.id);
    expect((onError.mock.calls[0]![1] as Error).message).toContain("SMTP profile");
  });
});

describe("logging", () => {
  beforeEach(() => clearLogBuffer());

  function logsMatching(text: string) {
    return getRecentLogs(500).filter((entry) => entry.msg.includes(text));
  }

  it("logs each refresh with every enabled newsletter's next run", async () => {
    await createNewsletter({ scheduleCron: "0 9 * * 1" });
    await createNewsletter({ isEnabled: false });

    await startScheduler(db, { cronFactory: fakeCronFactory });

    const [entry] = logsMatching("Scheduler updated: 1 enabled newsletter scheduled");
    expect(entry?.level).toBe(30);
    const schedule = entry!.schedule as { name: string; nextRun: string | null }[];
    expect(schedule).toHaveLength(1);
    expect(schedule[0]!.name).toBe("Weekly Digest");
    expect(new Date(schedule[0]!.nextRun!).getUTCDay()).toBe(1);
  });

  it("labels a missed-schedule catch-up and a normal scheduled fire by trigger", async () => {
    const newsletter = await createNewsletter({ scheduleCron: "0 9 * * 1" });
    await db
      .update(newsletters)
      .set({ createdAt: new Date("2024-01-01T00:00:00Z") })
      .where(eq(newsletters.id, newsletter.id));

    await startScheduler(db, { cronFactory: fakeCronFactory, now: () => new Date("2024-01-02T00:00:00Z") });
    await recordedJobs[0]!.callback();

    expect(logsMatching('Catching up "Weekly Digest"')[0]?.level).toBe(30);
    const skipped = logsMatching(`Didn't send newsletter "Weekly Digest"`);
    expect(skipped.map((entry) => entry.trigger)).toEqual(["scheduled", "catch-up"]);
  });
});
