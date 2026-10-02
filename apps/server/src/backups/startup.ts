import { existsSync, renameSync } from "node:fs";
import path from "node:path";
import { decrypt } from "@latestarr/crypto";
import { type Db, openSqliteFile, settings, smtpProfiles, sourceConnections } from "@latestarr/db";
import { isNotNull } from "drizzle-orm";
import type { Logger } from "../logger.js";
import { type BackupContext, createBackup } from "./service.js";

// What happens to the database at startup, before and after migrations:
// a restore staged by `cli.js restore` is swapped in, a pre-upgrade backup
// is taken when the version changed, and the encryption key is checked
// against what's saved.

/** Where `cli.js restore` leaves a checked database, for the next start to swap in. */
export function pendingRestorePath(databasePath: string): string {
  return path.join(path.dirname(databasePath), "restore-pending.db");
}

const SIDE_FILES = ["", "-wal", "-shm"];

/**
 * Swaps a staged restore into place. Runs before the database is opened, so
 * nothing has it open. The current database is kept beside it, renamed, in
 * case the restore was a mistake. Returns the kept file's name, if any.
 */
export function applyPendingRestore(databasePath: string, log: Logger, now = new Date()): string | null {
  const pending = pendingRestorePath(databasePath);
  if (!existsSync(pending)) return null;
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const kept = `${databasePath}.before-restore-${stamp}`;
  for (const suffix of SIDE_FILES) {
    if (existsSync(databasePath + suffix)) renameSync(databasePath + suffix, kept + suffix);
  }
  renameSync(pending, databasePath);
  log.warn(
    { kept: path.basename(kept) },
    `Restored the database from a backup. The previous database was kept as ${path.basename(kept)}.`,
  );
  return path.basename(kept);
}

const VERSION_KEY = "appVersion";

/** The version that last ran this database, read without the schema (before migrations). */
export function lastRunVersion(databasePath: string): { existing: boolean; version: string | null } {
  if (!existsSync(databasePath)) return { existing: false, version: null };
  const sqlite = openSqliteFile(databasePath, { readonly: true });
  try {
    const migrated = sqlite
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'")
      .get();
    if (!migrated) return { existing: false, version: null };
    const row = sqlite.prepare("SELECT value FROM settings WHERE key = ?").get(VERSION_KEY) as { value: string } | undefined;
    return { existing: true, version: row ? (JSON.parse(row.value) as string) : null };
  } catch {
    return { existing: true, version: null };
  } finally {
    sqlite.close();
  }
}

/**
 * Backs up the database before this version's migrations change it, when
 * it was last run by a different version. A database from before this
 * check existed has no version saved and is backed up as "earlier".
 */
export async function preUpgradeBackup(ctx: BackupContext, log: Logger): Promise<void> {
  const last = lastRunVersion(ctx.databasePath);
  if (!last.existing || last.version === ctx.version) return;
  const from = last.version ?? "earlier";
  try {
    const file = await createBackup(ctx, "pre-upgrade", log, { version: from });
    log.info({ filename: file.filename }, `Backed up the database before upgrading from ${from} to ${ctx.version}`);
  } catch (err) {
    // Not fatal: refusing to start would leave the app down, and most
    // upgrades don't need the backup. Said loudly instead.
    log.error({ err }, `Couldn't back up the database before upgrading to ${ctx.version}. Back it up by hand before relying on this version.`);
  }
}

export function recordRunVersion(db: Db, version: string): void {
  db.insert(settings)
    .values({ key: VERSION_KEY, value: version })
    .onConflictDoUpdate({ target: settings.key, set: { value: version } })
    .run();
}

/**
 * Checks ENCRYPTION_KEY can read what's saved, by decrypting one saved
 * credential. A restored backup with a different install's key would
 * otherwise fail later, one source or SMTP profile at a time.
 */
export function encryptionKeyMismatch(db: Db, key: string): boolean {
  const source = db
    .select({ value: sourceConnections.credentialsEncrypted })
    .from(sourceConnections)
    .limit(1)
    .get();
  const smtp = db
    .select({ value: smtpProfiles.authPassEncrypted })
    .from(smtpProfiles)
    .where(isNotNull(smtpProfiles.authPassEncrypted))
    .limit(1)
    .get();
  const sample = source?.value ?? smtp?.value;
  if (!sample) return false;
  try {
    decrypt(sample, key);
    return false;
  } catch {
    return true;
  }
}

export function warnOnKeyMismatch(db: Db, key: string, log: Logger): void {
  if (!encryptionKeyMismatch(db, key)) return;
  log.error(
    "ENCRYPTION_KEY can't read the credentials saved in this database, so sources and SMTP can't connect. " +
      "If you restored a backup from another install, set ENCRYPTION_KEY to that install's key and restart. " +
      "Otherwise, enter the sources' and SMTP profiles' credentials again.",
  );
}