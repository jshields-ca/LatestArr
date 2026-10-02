import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { type Db, openSqliteFile, settings } from "@latestarr/db";
import { Cron } from "croner";
import { eq } from "drizzle-orm";
import type { Logger } from "../logger.js";
import { createZip } from "./zip.js";

// Backups: a consistent snapshot of the database (SQLite's online backup
// API, never a raw copy of a live file), checked with integrity_check, and
// packed with a manifest into one ZIP file:
//
//   latestarr-backup-20260929T030000Z-v0.12.0-scheduled.zip
//
// The files in the backup folder are the source of truth for the list:
// everything about a backup is in its name and size, so a folder copied
// elsewhere, or a restored database, never disagrees with what's on disk.

export const BACKUP_TRIGGERS = ["scheduled", "manual", "pre-upgrade"] as const;
export type BackupTrigger = (typeof BACKUP_TRIGGERS)[number];

const FILE_PATTERN = /^latestarr-backup-(\d{8}T\d{6}Z)-v([0-9A-Za-z.+-]+?)-(scheduled|manual|pre-upgrade)\.zip$/;

/** Pre-upgrade backups are kept apart from the retention rules; this many of the newest stay. */
export const PRE_UPGRADE_KEEP = 3;

export interface BackupContext {
  db: Db;
  databasePath: string;
  backupDir: string;
  /** This LatestArr's version, written into each backup. */
  version: string;
  encryptionKey: string;
}

export interface BackupFile {
  filename: string;
  createdAt: Date;
  version: string;
  trigger: BackupTrigger;
  sizeBytes: number;
}

export interface BackupManifest {
  app: "LatestArr";
  formatVersion: 1;
  version: string;
  createdAt: string;
  trigger: BackupTrigger;
  /** How many database migrations had run, to tell versions apart. */
  migrations: number;
  integrityCheck: "ok";
  counts: Record<string, number>;
  /** A hash of ENCRYPTION_KEY, never the key, so a restore can tell whether the key matches. */
  encryptionKeyFingerprint: string;
}

export type BackupRetention =
  | { mode: "count"; keep: number }
  | { mode: "calendar"; daily: number; weekly: number; monthly: number };

export interface BackupSettings {
  enabled: boolean;
  scheduleCron: string;
  timezone: string;
  retention: BackupRetention;
}

export interface BackupRunStatus {
  at: string;
  ok: boolean;
  trigger: BackupTrigger;
  filename?: string;
  error?: string;
}

export function defaultBackupDir(databasePath: string): string {
  return process.env.BACKUP_PATH || path.join(path.dirname(databasePath), "backups");
}

export function defaultTimezone(): string {
  return process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

// On by default: an install with no backups at all loses everything to one
// bad disk or upgrade. Daily at 03:00, keeping the last seven.
export function defaultBackupSettings(): BackupSettings {
  return { enabled: true, scheduleCron: "0 3 * * *", timezone: defaultTimezone(), retention: { mode: "count", keep: 7 } };
}

const SETTINGS_KEY = "backups";
const STATUS_KEY = "backupStatus";

export function loadBackupSettings(db: Db): BackupSettings {
  const row = db.select().from(settings).where(eq(settings.key, SETTINGS_KEY)).get();
  return { ...defaultBackupSettings(), ...(row?.value as Partial<BackupSettings> | undefined) };
}

export function saveBackupSettings(db: Db, value: BackupSettings): void {
  db.insert(settings).values({ key: SETTINGS_KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
}

export function loadLastRun(db: Db): BackupRunStatus | null {
  const row = db.select().from(settings).where(eq(settings.key, STATUS_KEY)).get();
  return (row?.value as BackupRunStatus | undefined) ?? null;
}

function saveLastRun(db: Db, value: BackupRunStatus): void {
  db.insert(settings).values({ key: STATUS_KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
}

export function keyFingerprint(key: string): string {
  return createHash("sha256").update(`latestarr-key-fingerprint:${key}`).digest("hex").slice(0, 16);
}

function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function parseStamp(value: string): Date {
  const [, y, mo, d, h, mi, s] = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/)!;
  return new Date(Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, +s!));
}

/** Parses a backup's file name; null for anything else in the folder. */
export function parseBackupFilename(filename: string): Omit<BackupFile, "sizeBytes"> | null {
  const match = filename.match(FILE_PATTERN);
  if (!match) return null;
  return { filename, createdAt: parseStamp(match[1]!), version: match[2]!, trigger: match[3] as BackupTrigger };
}

/** The backups in the folder, newest first. */
export async function listBackups(backupDir: string): Promise<BackupFile[]> {
  let names: string[];
  try {
    names = await readdir(backupDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const files: BackupFile[] = [];
  for (const name of names) {
    const parsed = parseBackupFilename(name);
    if (!parsed) continue;
    const info = await stat(path.join(backupDir, name));
    files.push({ ...parsed, sizeBytes: info.size });
  }
  return files.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Finds a backup in the folder by name. The path is built from the folder's
 * own listing, never from the name asked for, so no request can reach a
 * file outside the folder or one that isn't a backup.
 */
export async function findBackup(backupDir: string, filename: string): Promise<{ file: BackupFile; path: string } | null> {
  const match = (await listBackups(backupDir)).find((file) => file.filename === filename);
  return match ? { file: match, path: path.join(backupDir, match.filename) } : null;
}


const RESTORE_README = `This is a LatestArr backup.

latestarr.db   the database: sources, designs, newsletters, recipients,
               users, and send history. Credentials inside are encrypted
               with your ENCRYPTION_KEY, which is NOT in this backup.
manifest.json  when and how this backup was made, by which version.

To restore it, follow "Restoring a backup" in LatestArr's docs:
https://github.com/jshields-ca/LatestArr/blob/main/docs/self-hosting.md#restoring-a-backup

This file holds people's email addresses and send history. Keep it as
private as the server itself.
`;

const COUNTED_TABLES = ["users", "source_connections", "newsletters", "templates", "recipients", "recipient_groups", "send_runs"];

/**
 * Opens a snapshot file and checks it, returning what goes in the manifest.
 * The snapshot is switched out of WAL mode first, so it's one self-contained
 * file (no -wal or -shm beside it) to archive and later restore.
 */
export function inspectSnapshot(file: string): { migrations: number; counts: Record<string, number>; problem?: string } {
  const sqlite = openSqliteFile(file);
  try {
    sqlite.pragma("journal_mode = DELETE");
    const result = sqlite.pragma("integrity_check") as { integrity_check: string }[];
    const ok = result.length === 1 && result[0]!.integrity_check === "ok";
    const counts: Record<string, number> = {};
    for (const table of COUNTED_TABLES) {
      try {
        counts[table] = (sqlite.prepare(`SELECT count(*) AS n FROM "${table}"`).get() as { n: number }).n;
      } catch {
        // A table an older version didn't have yet.
      }
    }
    let migrations = 0;
    try {
      migrations = (sqlite.prepare(`SELECT count(*) AS n FROM "__drizzle_migrations"`).get() as { n: number }).n;
    } catch {
      migrations = 0;
    }
    return {
      migrations,
      counts,
      problem: ok ? undefined : `The snapshot failed SQLite's integrity check: ${result.map((r) => r.integrity_check).join("; ").slice(0, 300)}`,
    };
  } finally {
    sqlite.close();
  }
}

let running: Promise<BackupFile> | null = null;

export class BackupAlreadyRunningError extends Error {
  constructor() {
    super("A backup is already running. Try again in a moment.");
  }
}

/**
 * Makes a backup. Throws if it fails, after recording the failure; the
 * caller decides how loudly to report it. Only one runs at a time.
 */
export async function createBackup(
  ctx: BackupContext,
  trigger: BackupTrigger,
  log: Logger,
  options: { version?: string; now?: Date } = {},
): Promise<BackupFile> {
  if (running) throw new BackupAlreadyRunningError();
  running = makeBackup(ctx, trigger, log, options);
  try {
    return await running;
  } finally {
    running = null;
  }
}

async function makeBackup(
  ctx: BackupContext,
  trigger: BackupTrigger,
  log: Logger,
  options: { version?: string; now?: Date },
): Promise<BackupFile> {
  const now = options.now ?? new Date();
  const version = (options.version ?? ctx.version).replace(/[^0-9A-Za-z.+-]/g, "-");
  const filename = `latestarr-backup-${stamp(now)}-v${version}-${trigger}.zip`;
  const finalPath = path.join(ctx.backupDir, filename);
  const snapshotPath = path.join(ctx.backupDir, `.${filename}.db.tmp`);
  const partialPath = `${finalPath}.tmp`;

  try {
    await mkdir(ctx.backupDir, { recursive: true });
    // SQLite's online backup: consistent even while LatestArr keeps running.
    await ctx.db.$client.backup(snapshotPath);
    const inspected = inspectSnapshot(snapshotPath);
    if (inspected.problem) throw new Error(inspected.problem);

    const manifest: BackupManifest = {
      app: "LatestArr",
      formatVersion: 1,
      version,
      createdAt: now.toISOString(),
      trigger,
      migrations: inspected.migrations,
      integrityCheck: "ok",
      counts: inspected.counts,
      encryptionKeyFingerprint: keyFingerprint(ctx.encryptionKey),
    };
    const archive = await createZip(
      [
        { name: "latestarr.db", data: await readFile(snapshotPath) },
        { name: "manifest.json", data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`) },
        { name: "README.txt", data: Buffer.from(RESTORE_README) },
      ],
      now,
    );
    // Written under a temporary name and renamed, so a crash never leaves
    // a half-written file that looks like a finished backup.
    await writeFile(partialPath, archive, { mode: 0o600 });
    await rename(partialPath, finalPath);

    const file: BackupFile = { filename, createdAt: new Date(Math.floor(now.getTime() / 1000) * 1000), version, trigger, sizeBytes: archive.length };
    saveLastRun(ctx.db, { at: now.toISOString(), ok: true, trigger, filename });
    log.info({ filename, sizeBytes: archive.length, trigger }, `Backed up the database to ${filename}`);
    return file;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    saveLastRun(ctx.db, { at: now.toISOString(), ok: false, trigger, error: message });
    await rm(partialPath, { force: true }).catch(() => undefined);
    throw err;
  } finally {
    await rm(snapshotPath, { force: true }).catch(() => undefined);
  }
}

function calendarKeys(date: Date, timezone: string): { day: string; week: string; month: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  // ISO week of that local date.
  const local = new Date(Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!));
  const weekday = local.getUTCDay() || 7;
  local.setUTCDate(local.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(local.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((local.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return { day, week: `${local.getUTCFullYear()}-W${week}`, month: `${parts.year}-${parts.month}` };
}

/**
 * Which backups the retention rules keep. The newest backup is always kept,
 * and pre-upgrade backups follow their own rule (the newest few) so an
 * upgrade can always be undone.
 */
export function backupsToKeep(files: BackupFile[], retention: BackupRetention, timezone: string): Set<string> {
  const keep = new Set<string>();
  const regular = files.filter((f) => f.trigger !== "pre-upgrade").sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const preUpgrade = files.filter((f) => f.trigger === "pre-upgrade").sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  for (const file of preUpgrade.slice(0, PRE_UPGRADE_KEEP)) keep.add(file.filename);
  if (regular[0]) keep.add(regular[0].filename);

  if (retention.mode === "count") {
    for (const file of regular.slice(0, retention.keep)) keep.add(file.filename);
    return keep;
  }
  // Calendar ("grandfather-father-son"): the newest backup of each of the
  // last N days, weeks, and months that have one.
  const buckets: [keyof ReturnType<typeof calendarKeys>, number][] = [
    ["day", retention.daily],
    ["week", retention.weekly],
    ["month", retention.monthly],
  ];
  for (const [unit, limit] of buckets) {
    const seen = new Set<string>();
    for (const file of regular) {
      if (seen.size >= limit) break;
      const key = calendarKeys(file.createdAt, timezone)[unit];
      if (seen.has(key)) continue;
      seen.add(key);
      keep.add(file.filename);
    }
  }
  return keep;
}

/** Deletes the backups retention doesn't keep. Only call after a backup succeeded. */
export async function pruneBackups(ctx: BackupContext, log: Logger): Promise<string[]> {
  const config = loadBackupSettings(ctx.db);
  const files = await listBackups(ctx.backupDir);
  const keep = backupsToKeep(files, config.retention, config.timezone);
  const removed: string[] = [];
  for (const file of files) {
    if (keep.has(file.filename)) continue;
    await rm(path.join(ctx.backupDir, file.filename), { force: true });
    removed.push(file.filename);
  }
  if (removed.length > 0) {
    log.info({ removed }, `Removed ${removed.length} old backup${removed.length === 1 ? "" : "s"} under the retention rules`);
  }
  return removed;
}

export function nextBackupRun(config: BackupSettings, after = new Date()): Date | null {
  if (!config.enabled) return null;
  try {
    const job = new Cron(config.scheduleCron, { timezone: config.timezone, paused: true });
    const next = job.nextRun(after);
    job.stop();
    return next;
  } catch {
    return null;
  }
}
