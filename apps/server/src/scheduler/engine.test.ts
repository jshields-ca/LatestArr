import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, newsletters, runMigrations, type Db } from "@latestarr/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
