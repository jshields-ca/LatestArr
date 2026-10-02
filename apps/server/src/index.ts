import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, runMigrations } from "@latestarr/db";
import { appVersion, buildApp } from "./app.js";
import { BackupScheduler } from "./backups/runner.js";
import { type BackupContext, defaultBackupDir } from "./backups/service.js";
import {
  applyPendingRestore,
  preUpgradeBackup,
  recordRunVersion,
  warnOnKeyMismatch,
} from "./backups/startup.js";
import { logger } from "./logger.js";
import { migrateContentIntoDesigns } from "./render/migrate-content-into-designs.js";
import { encryptionKeyProblem, getEncryptionKey } from "./secrets.js";
import { startScheduler } from "./scheduler/engine.js";

const keyProblem = encryptionKeyProblem();
if (keyProblem) {
  logger.fatal(keyProblem);
  process.exit(1);
}

const databasePath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "latestarr.db");
mkdirSync(path.dirname(databasePath), { recursive: true });
// A restore staged with `cli.js restore` goes in before anything opens the database.
applyPendingRestore(databasePath, logger);
const db = createDb(databasePath);

const backups: BackupContext = {
  db,
  databasePath,
  backupDir: defaultBackupDir(databasePath),
  version: appVersion,
  encryptionKey: getEncryptionKey(),
};
// Before this version's migrations change anything.
await preUpgradeBackup(backups, logger);
runMigrations(db);
recordRunVersion(db, appVersion);
migrateContentIntoDesigns(db, logger);
warnOnKeyMismatch(db, backups.encryptionKey, logger);

const scheduler = await startScheduler(db);
const backupScheduler = new BackupScheduler(backups, logger);
backupScheduler.refresh();

// The Docker image copies apps/web's build output to ./public next to this
// file's compiled dist/ directory (see docker/Dockerfile); local dev has no
// such directory since Vite serves the frontend separately, and buildApp()
// only registers static serving when the path actually exists.
const staticRoot =
  process.env.STATIC_ROOT ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const app = await buildApp(db, scheduler, { staticRoot, backups: { ctx: backups, scheduler: backupScheduler } });

const port = Number(process.env.PORT ?? 3000);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
