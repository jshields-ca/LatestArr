import { existsSync } from "node:fs";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Db } from "@latestarr/db";
import { sql } from "drizzle-orm";
import { type BackupManifest, inspectSnapshot, keyFingerprint } from "./service.js";
import { pendingRestorePath } from "./startup.js";
import { readZip } from "./zip.js";

export interface CheckedBackup {
  file: string;
  manifest: BackupManifest;
  database: Buffer;
  keyMatches: boolean;
  /** Made by a newer LatestArr than this one, which can't open it. */
  newerThanThis: boolean;
}

/** A backup by path, or by name in the backup folder. */
export function resolveBackupFile(name: string, backupDir: string): string {
  if (path.isAbsolute(name) || existsSync(name)) return path.resolve(name);
  return path.join(backupDir, name);
}

/**
 * Reads a backup archive and checks it can be restored here: it's a
 * LatestArr backup, its files aren't damaged, the database passes SQLite's
 * integrity check, and whether it was made with this ENCRYPTION_KEY and by
 * this version or an older one.
 */
export async function checkBackup(file: string, db: Db, encryptionKey: string, scratchDir: string): Promise<CheckedBackup> {
  let archive: Buffer;
  try {
    archive = await readFile(file);
  } catch {
    throw new Error(`There's no backup at ${file}`);
  }
  const entries = await readZip(archive);
  const database = entries.find((entry) => entry.name === "latestarr.db")?.data;
  const manifestEntry = entries.find((entry) => entry.name === "manifest.json")?.data;
  if (!database || !manifestEntry) throw new Error(`${path.basename(file)} isn't a LatestArr backup`);
  const manifest = JSON.parse(manifestEntry.toString("utf8")) as BackupManifest;
  if (manifest.app !== "LatestArr") throw new Error(`${path.basename(file)} isn't a LatestArr backup`);

  // integrity_check needs a file, so the database is checked from a scratch copy.
  const scratch = path.join(scratchDir, `.check-${process.pid}-${Date.now()}.db`);
  try {
    await writeFile(scratch, database, { mode: 0o600 });
    const inspected = inspectSnapshot(scratch);
    if (inspected.problem) throw new Error(inspected.problem);
  } finally {
    await rm(scratch, { force: true });
  }

  const known = db.get<{ n: number }>(sql`SELECT count(*) AS n FROM "__drizzle_migrations"`).n;
  return {
    file,
    manifest,
    database,
    keyMatches: manifest.encryptionKeyFingerprint === keyFingerprint(encryptionKey),
    newerThanThis: manifest.migrations > known,
  };
}

/**
 * Leaves a checked backup's database where the next start swaps it in (see
 * applyPendingRestore). Nothing changes until LatestArr restarts, and the
 * current database is kept.
 */
export async function stageRestore(checked: CheckedBackup, databasePath: string): Promise<string> {
  const pending = pendingRestorePath(databasePath);
  await writeFile(`${pending}.tmp`, checked.database, { mode: 0o600 });
  await rename(`${pending}.tmp`, pending);
  return pending;
}

export async function cancelStagedRestore(databasePath: string): Promise<boolean> {
  const pending = pendingRestorePath(databasePath);
  if (!existsSync(pending)) return false;
  await rm(pending, { force: true });
  return true;
}
