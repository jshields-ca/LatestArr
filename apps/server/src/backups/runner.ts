import { Cron } from "croner";
import { logger as defaultLogger, type Logger } from "../logger.js";
import { sendBackupFailureAlert } from "../notifications/alerts.js";
import {
  BackupAlreadyRunningError,
  type BackupContext,
  type BackupFile,
  type BackupTrigger,
  createBackup,
  loadBackupSettings,
  pruneBackups,
} from "./service.js";

/**
 * Makes a backup, then applies retention. A failure is logged and alerted
 * (and rethrown for a caller that wants it, like "Back up now"); retention
 * only runs after a backup succeeds, so a failing backup never deletes old
 * ones.
 */
export async function runBackup(ctx: BackupContext, trigger: BackupTrigger, log: Logger): Promise<BackupFile> {
  let file: BackupFile;
  try {
    file = await createBackup(ctx, trigger, log);
  } catch (err) {
    if (err instanceof BackupAlreadyRunningError) throw err;
    const reason = err instanceof Error ? err.message : String(err);
    log.error({ err, trigger }, `The ${trigger} backup failed: ${reason}`);
    await sendBackupFailureAlert(ctx.db, reason, log);
    throw err;
  }
  try {
    await pruneBackups(ctx, log);
  } catch (err) {
    log.warn({ err }, "Couldn't remove old backups under the retention rules");
  }
  return file;
}

/** The scheduled backup job. `refresh()` picks up changed settings. */
export class BackupScheduler {
  private job: Cron | null = null;

  constructor(
    private readonly ctx: BackupContext,
    private readonly log: Logger = defaultLogger,
  ) {}

  refresh(): void {
    this.job?.stop();
    this.job = null;
    const config = loadBackupSettings(this.ctx.db);
    if (!config.enabled) {
      this.log.info("Scheduled backups are off");
      return;
    }
    try {
      this.job = new Cron(config.scheduleCron, { timezone: config.timezone, protect: true }, () => {
        void runBackup(this.ctx, "scheduled", this.log).catch(() => undefined);
      });
      this.log.info({ nextRun: this.job.nextRun()?.toISOString() ?? null }, "Scheduled backups updated");
    } catch (err) {
      this.log.error({ err }, `Scheduled backups are off: "${config.scheduleCron}" isn't a valid schedule`);
    }
  }

  stop(): void {
    this.job?.stop();
    this.job = null;
  }
}
