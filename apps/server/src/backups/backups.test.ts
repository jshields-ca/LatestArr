import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { encrypt } from "@latestarr/crypto";
import { createDb, type Db, openSqliteFile, runMigrations, settings, sourceConnections, users } from "@latestarr/db";
import { eq } from "drizzle-orm";
import pino from "pino";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Logger } from "../logger.js";
import { runCli } from "../cli.js";
import { checkBackup } from "./restore.js";
import { runBackup } from "./runner.js";
import {
  type BackupContext,
  type BackupFile,
  backupPath,
  backupsToKeep,
  createBackup,
  keyFingerprint,
  listBackups,
  loadLastRun,
  parseBackupFilename,
  saveBackupSettings,
  defaultBackupSettings,
} from "./service.js";
import {
  applyPendingRestore,
  encryptionKeyMismatch,
  lastRunVersion,
  pendingRestorePath,
  preUpgradeBackup,
  recordRunVersion,
} from "./startup.js";
import { createZip, readZip } from "./zip.js";

const KEY = "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=";
const OTHER_KEY = "OTg3NjU0MzIxMDk4NzY1NDMyMTA5ODc2NTQzMjEwOTg=";
const log = pino({ level: "silent" }) as unknown as Logger;

let dir: string;
let databasePath: string;
let db: Db;
let ctx: BackupContext;

beforeEach(() => {
  process.env.ENCRYPTION_KEY = KEY;
  dir = mkdtempSync(path.join(tmpdir(), "latestarr-backup-test-"));
  databasePath = path.join(dir, "data", "latestarr.db");
  mkdirSync(path.dirname(databasePath));
  db = createDb(databasePath);
  runMigrations(db);
  db.insert(users).values({ email: "admin@example.com", displayName: "Admin", role: "admin" }).run();
  ctx = { db, databasePath, backupDir: path.join(dir, "backups"), version: "0.12.0", encryptionKey: KEY };
});

afterEach(() => {
  db.$client.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  delete process.env.ENCRYPTION_KEY;
});

function file(name: string): BackupFile {
  const parsed = parseBackupFilename(name)!;
  return { ...parsed, sizeBytes: 1 };
}

describe("backup archives", () => {
  it("round-trips through the ZIP writer and reader, and notices damage", async () => {
    const zip = await createZip([
      { name: "a.txt", data: Buffer.from("hello ".repeat(100)) },
      { name: "b.bin", data: Buffer.from([0, 1, 2, 3]) },
    ]);
    const entries = await readZip(zip);
    expect(entries.map((e) => e.name)).toEqual(["a.txt", "b.bin"]);
    expect(entries[0]!.data.toString()).toBe("hello ".repeat(100));
    // Corrupt the CRC of the first entry.
    const damaged = Buffer.from(zip);
    damaged.writeUInt32LE(0, 14);
    const centralAt = damaged.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    damaged.writeUInt32LE(0, centralAt + 16);
    await expect(readZip(damaged)).rejects.toThrow(/damaged/);
  });

  it("makes a checked backup with a manifest, readable as a database", async () => {
    const backup = await createBackup(ctx, "manual", log, { now: new Date("2026-09-29T03:00:00Z") });
    expect(backup.filename).toBe("latestarr-backup-20260929T030000Z-v0.12.0-manual.zip");
    const entries = await readZip(readFileSync(path.join(ctx.backupDir, backup.filename)));
    expect(entries.map((e) => e.name)).toEqual(["latestarr.db", "manifest.json", "README.txt"]);
    const manifest = JSON.parse(entries[1]!.data.toString());
    expect(manifest).toMatchObject({
      app: "LatestArr",
      version: "0.12.0",
      trigger: "manual",
      integrityCheck: "ok",
      encryptionKeyFingerprint: keyFingerprint(KEY),
    });
    expect(manifest.counts.users).toBe(1);
    expect(manifest.migrations).toBeGreaterThan(0);
    // Never the key itself.
    expect(entries[1]!.data.toString()).not.toContain(KEY);

    const restored = path.join(dir, "restored.db");
    writeFileSync(restored, entries[0]!.data);
    const sqlite = openSqliteFile(restored, { readonly: true });
    expect(sqlite.prepare("SELECT email FROM users").get()).toEqual({ email: "admin@example.com" });
    sqlite.close();

    // No temporary files left behind.
    expect(readdirSync(ctx.backupDir)).toEqual([backup.filename]);
    expect(loadLastRun(db)).toMatchObject({ ok: true, filename: backup.filename });
  });

  it("lists only backups, newest first, and never resolves a name outside the folder", async () => {
    await createBackup(ctx, "manual", log, { now: new Date("2026-09-28T03:00:00Z") });
    await createBackup(ctx, "scheduled", log, { now: new Date("2026-09-29T03:00:00Z") });
    writeFileSync(path.join(ctx.backupDir, "notes.txt"), "not a backup");
    const files = await listBackups(ctx.backupDir);
    expect(files.map((f) => f.trigger)).toEqual(["scheduled", "manual"]);
    expect(backupPath(ctx.backupDir, "../latestarr.db")).toBeNull();
    expect(backupPath(ctx.backupDir, "notes.txt")).toBeNull();
    expect(backupPath(ctx.backupDir, "latestarr-backup-20260929T030000Z-v0.12.0-manual.zip/../../x")).toBeNull();
  });

  it("records a failure, alerts, and keeps older backups when a backup can't be written", async () => {
    await createBackup(ctx, "manual", log, { now: new Date("2026-09-28T03:00:00Z") });
    // A file where the folder should be.
    const broken = { ...ctx, backupDir: path.join(dir, "blocked") };
    writeFileSync(broken.backupDir, "in the way");
    await expect(runBackup(broken, "scheduled", log)).rejects.toThrow();
    expect(loadLastRun(db)).toMatchObject({ ok: false, trigger: "scheduled" });
    expect(await listBackups(ctx.backupDir)).toHaveLength(1);
  });

  it("applies retention after a successful backup", async () => {
    saveBackupSettings(db, { ...defaultBackupSettings(), retention: { mode: "count", keep: 2 } });
    for (const day of ["25", "26", "27"]) {
      await createBackup(ctx, "scheduled", log, { now: new Date(`2026-09-${day}T03:00:00Z`) });
    }
    await runBackup(ctx, "manual", log);
    const left = await listBackups(ctx.backupDir);
    expect(left).toHaveLength(2);
    expect(left[1]!.filename).toContain("20260927");
  });
});

describe("retention", () => {
  const daily = Array.from({ length: 40 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 30) - i * 86_400_000);
    return file(`latestarr-backup-${d.toISOString().slice(0, 10).replace(/-/g, "")}T030000Z-v0.12.0-scheduled.zip`);
  });

  it("keeps the newest N, always including the newest", () => {
    const keep = backupsToKeep(daily, { mode: "count", keep: 7 }, "UTC");
    expect(keep.size).toBe(7);
    expect(keep.has(daily[0]!.filename)).toBe(true);
    expect(keep.has(daily[7]!.filename)).toBe(false);
  });

  it("keeps daily, weekly, and monthly backups on the calendar rule", () => {
    const keep = backupsToKeep(daily, { mode: "calendar", daily: 3, weekly: 2, monthly: 2 }, "UTC");
    const kept = daily.filter((f) => keep.has(f.filename)).map((f) => f.filename.slice(17, 25));
    // 3 newest days, the newest of this and last week (already among them, plus one), and the newest of September and August.
    expect(kept).toEqual(expect.arrayContaining(["20260930", "20260929", "20260928", "20260831"]));
    expect(kept.length).toBeLessThanOrEqual(7);
  });

  it("keeps the newest pre-upgrade backups apart from the rules", () => {
    const upgrades = ["20260101", "20260201", "20260301", "20260401"].map((d) =>
      file(`latestarr-backup-${d}T030000Z-v0.11.0-pre-upgrade.zip`),
    );
    const keep = backupsToKeep([...daily, ...upgrades], { mode: "count", keep: 1 }, "UTC");
    expect(upgrades.filter((f) => keep.has(f.filename))).toHaveLength(3);
    expect(keep.has(upgrades[0]!.filename)).toBe(false);
  });
});

describe("startup", () => {
  it("backs up before an upgrade, but not on a fresh database or the same version", async () => {
    // This database has never recorded a version: it predates the check.
    await preUpgradeBackup(ctx, log);
    let files = await listBackups(ctx.backupDir);
    expect(files.map((f) => [f.trigger, f.version])).toEqual([["pre-upgrade", "earlier"]]);

    recordRunVersion(db, "0.12.0");
    await preUpgradeBackup(ctx, log);
    expect(await listBackups(ctx.backupDir)).toHaveLength(1);

    recordRunVersion(db, "0.11.2");
    expect(lastRunVersion(databasePath)).toEqual({ existing: true, version: "0.11.2" });
    await preUpgradeBackup(ctx, log);
    files = await listBackups(ctx.backupDir);
    expect(files.map((f) => f.version)).toContain("0.11.2");

    const fresh = path.join(dir, "fresh.db");
    expect(lastRunVersion(fresh)).toEqual({ existing: false, version: null });
  });

  it("swaps in a staged restore, keeping the old database", () => {
    db.$client.close();
    writeFileSync(pendingRestorePath(databasePath), readFileSync(databasePath));
    const kept = applyPendingRestore(databasePath, log, new Date("2026-10-01T12:00:00Z"));
    expect(kept).toBe("latestarr.db.before-restore-20261001T120000Z");
    expect(existsSync(path.join(path.dirname(databasePath), kept!))).toBe(true);
    expect(existsSync(pendingRestorePath(databasePath))).toBe(false);
    expect(applyPendingRestore(databasePath, log)).toBeNull();
    db = createDb(databasePath);
  });

  it("notices when ENCRYPTION_KEY can't read the saved credentials", () => {
    expect(encryptionKeyMismatch(db, KEY)).toBe(false);
    db.insert(sourceConnections)
      .values({ name: "Plex", kind: "plex", baseUrl: "http://plex", credentialsEncrypted: encrypt('{"token":"x"}', KEY) })
      .run();
    expect(encryptionKeyMismatch(db, KEY)).toBe(false);
    expect(encryptionKeyMismatch(db, OTHER_KEY)).toBe(true);
  });
});

describe("restoring with the recovery command", () => {
  function run(args: string[], key = KEY) {
    const out: string[] = [];
    const err: string[] = [];
    return runCli(db, args, { out: (l) => out.push(l), err: (l) => err.push(l), readPassword: async () => null }, {
      databasePath,
      backupDir: ctx.backupDir,
      encryptionKey: key,
    }).then((code) => ({ code, out: out.join("\n"), err: err.join("\n") }));
  }

  it("checks a backup, stages it for the next start, and can cancel", async () => {
    const backup = await createBackup(ctx, "manual", log);
    const checked = await run(["check-backup", backup.filename]);
    expect(checked.code).toBe(0);
    expect(checked.out).toContain("Passes SQLite's integrity check");
    expect(checked.out).toContain("Made with this server's ENCRYPTION_KEY");

    const staged = await run(["restore", backup.filename]);
    expect(staged.code).toBe(0);
    expect(staged.out).toContain("Restart LatestArr");
    expect(existsSync(pendingRestorePath(databasePath))).toBe(true);

    expect((await run(["restore", "--cancel"])).out).toContain("Cancelled");
    expect(existsSync(pendingRestorePath(databasePath))).toBe(false);
  });

  it("won't restore a backup made with another key unless told to", async () => {
    const backup = await createBackup(ctx, "manual", log);
    const refused = await run(["restore", backup.filename], OTHER_KEY);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain("DIFFERENT ENCRYPTION_KEY");
    expect(existsSync(pendingRestorePath(databasePath))).toBe(false);
    const forced = await run(["restore", backup.filename, "--ignore-key-mismatch"], OTHER_KEY);
    expect(forced.code).toBe(0);
  });

  it("refuses something that isn't a backup, or one from a newer version", async () => {
    writeFileSync(path.join(dir, "junk.zip"), "nope");
    expect((await run(["restore", path.join(dir, "junk.zip")])).err).toContain("Can't use this backup");
    expect((await run(["restore", "missing.zip"])).code).toBe(1);

    const backup = await createBackup(ctx, "manual", log);
    // Pretend this server knows fewer migrations than the backup.
    db.$client.prepare(`DELETE FROM "__drizzle_migrations" WHERE rowid = (SELECT max(rowid) FROM "__drizzle_migrations")`).run();
    const checked = await checkBackup(path.join(ctx.backupDir, backup.filename), db, KEY, dir);
    expect(checked.newerThanThis).toBe(true);
    expect((await run(["restore", backup.filename])).err).toContain("newer version");
  });

  it("keeps settings readable after a version is recorded", () => {
    recordRunVersion(db, "0.12.0");
    expect(db.select().from(settings).where(eq(settings.key, "appVersion")).get()?.value).toBe("0.12.0");
  });
});
