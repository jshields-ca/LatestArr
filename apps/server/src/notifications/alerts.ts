import { decrypt, encrypt } from "@latestarr/crypto";
import { type Db, settings, smtpProfiles } from "@latestarr/db";
import { eq } from "drizzle-orm";
import type { Logger } from "../logger.js";
import { smtpCredentialsFor } from "../mailer/credentials.js";
import { sendEmail } from "../mailer/send.js";
import { getEncryptionKey } from "../secrets.js";

export const WEBHOOK_FORMATS = ["discord", "slack", "ntfy", "apprise", "json"] as const;
export type WebhookFormat = (typeof WEBHOOK_FORMATS)[number];

export interface NotificationSettings {
  onFailure: boolean;
  onPartialFailure: boolean;
  onBackupFailure: boolean;
  email: { enabled: boolean; smtpProfileId: string | null; to: string };
  webhook: { enabled: boolean; format: WebhookFormat; url: string | null };
}

// What's stored in the settings table. The webhook URL is encrypted because
// Discord and Slack webhook URLs work like passwords: anyone holding one can
// post to the channel.
interface StoredNotificationSettings extends Omit<NotificationSettings, "webhook"> {
  webhook: { enabled: boolean; format: WebhookFormat; urlEncrypted: string | null };
}

const SETTINGS_KEY = "notifications";

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  onFailure: true,
  onPartialFailure: true,
  onBackupFailure: true,
  email: { enabled: false, smtpProfileId: null, to: "" },
  webhook: { enabled: false, format: "discord", url: null },
};

export async function loadNotificationSettings(db: Db): Promise<NotificationSettings> {
  const [row] = await db.select().from(settings).where(eq(settings.key, SETTINGS_KEY));
  if (!row) return DEFAULT_NOTIFICATION_SETTINGS;
  const stored = row.value as StoredNotificationSettings;
  return {
    onFailure: stored.onFailure,
    onPartialFailure: stored.onPartialFailure,
    // Saved before backups existed: on, like a new install.
    onBackupFailure: stored.onBackupFailure ?? true,
    email: stored.email,
    webhook: {
      enabled: stored.webhook.enabled,
      format: stored.webhook.format,
      url: stored.webhook.urlEncrypted ? decrypt(stored.webhook.urlEncrypted, getEncryptionKey()) : null,
    },
  };
}

export async function saveNotificationSettings(db: Db, value: NotificationSettings): Promise<void> {
  const stored: StoredNotificationSettings = {
    onFailure: value.onFailure,
    onPartialFailure: value.onPartialFailure,
    onBackupFailure: value.onBackupFailure,
    email: value.email,
    webhook: {
      enabled: value.webhook.enabled,
      format: value.webhook.format,
      urlEncrypted: value.webhook.url ? encrypt(value.webhook.url, getEncryptionKey()) : null,
    },
  };
  await db
    .insert(settings)
    .values({ key: SETTINGS_KEY, value: stored })
    .onConflictDoUpdate({ target: settings.key, set: { value: stored } });
}

export interface FailureAlert {
  kind: "failed" | "partial_failure";
  newsletterId: string;
  newsletterName: string;
  trigger: string;
  reason: string;
  sendRunId?: string;
}

interface AlertMessage {
  title: string;
  body: string;
}

function messageFor(alert: FailureAlert): AlertMessage {
  const title =
    alert.kind === "failed"
      ? `LatestArr: "${alert.newsletterName}" failed to send`
      : `LatestArr: "${alert.newsletterName}" only partly sent`;
  const body = `${alert.reason}\n\nTriggered by: ${alert.trigger} send. Open the Logs page in LatestArr for details.`;
  return { title, body };
}

function webhookRequest(format: WebhookFormat, message: AlertMessage, alert: FailureAlert | null, event?: string): RequestInit {
  const json = (payload: unknown): RequestInit => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  switch (format) {
    case "discord":
      return json({ content: `**${message.title}**\n${message.body}` });
    case "slack":
      return json({ text: `*${message.title}*\n${message.body}` });
    case "ntfy":
      // ntfy takes the message as the plain-text body, with metadata in headers.
      return {
        method: "POST",
        headers: { Title: message.title, Priority: "high", Tags: "warning" },
        body: message.body,
      };
    case "apprise":
      return json({ title: message.title, body: message.body, type: "failure" });
    case "json":
      return json({
        event: alert ? `newsletter.${alert.kind}` : (event ?? "test"),
        title: message.title,
        message: message.body,
        newsletter: alert ? { id: alert.newsletterId, name: alert.newsletterName } : null,
        trigger: alert?.trigger ?? null,
        sendRunId: alert?.sendRunId ?? null,
        time: new Date().toISOString(),
      });
  }
}

export interface DeliveryResult {
  destination: "email" | "webhook";
  ok: boolean;
  error?: string;
}

async function deliver(
  db: Db,
  config: NotificationSettings,
  message: AlertMessage,
  alert: FailureAlert | null,
  event?: string,
): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];

  if (config.email.enabled) {
    try {
      const [profile] = config.email.smtpProfileId
        ? await db.select().from(smtpProfiles).where(eq(smtpProfiles.id, config.email.smtpProfileId))
        : [];
      if (!profile) throw new Error("The SMTP profile chosen for alerts no longer exists");
      if (!config.email.to) throw new Error("No alert email address is set");
      await sendEmail(smtpCredentialsFor(profile), {
        from: `${profile.defaultFromName} <${profile.defaultFromEmail}>`,
        to: config.email.to,
        subject: message.title,
        html: `<p>${escapeHtml(message.body).replace(/\n/g, "<br>")}</p>`,
        text: message.body,
      });
      results.push({ destination: "email", ok: true });
    } catch (err) {
      results.push({ destination: "email", ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  if (config.webhook.enabled) {
    try {
      if (!config.webhook.url) throw new Error("No webhook URL is set");
      const response = await fetch(config.webhook.url, {
        ...webhookRequest(config.webhook.format, message, alert, event),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`The webhook responded with HTTP ${response.status}`);
      results.push({ destination: "webhook", ok: true });
    } catch (err) {
      results.push({ destination: "webhook", ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return results;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// One alert per newsletter and kind per hour, so a broken SMTP server or
// source can't flood the channel on every retry. In memory only: a restart
// allows one more alert, which is fine.
const RATE_LIMIT_MS = 60 * 60 * 1000;
const lastAlertAt = new Map<string, number>();

export function resetAlertRateLimit(): void {
  lastAlertAt.clear();
}

// Never throws: an alert that can't be delivered is logged, and must not
// turn into a second failure for the send that triggered it.
export async function sendFailureAlert(db: Db, alert: FailureAlert, log: Logger): Promise<void> {
  try {
    const config = await loadNotificationSettings(db);
    const wanted = alert.kind === "failed" ? config.onFailure : config.onPartialFailure;
    if (!wanted || (!config.email.enabled && !config.webhook.enabled)) return;

    const key = `${alert.newsletterId}:${alert.kind}`;
    const last = lastAlertAt.get(key);
    if (last !== undefined && Date.now() - last < RATE_LIMIT_MS) {
      log.debug(`Skipped a repeat alert for "${alert.newsletterName}" (one per hour)`);
      return;
    }
    lastAlertAt.set(key, Date.now());

    for (const result of await deliver(db, config, messageFor(alert), alert)) {
      if (result.ok) {
        log.info({ destination: result.destination }, `Sent a ${result.destination} alert about "${alert.newsletterName}"`);
      } else {
        log.warn(
          { destination: result.destination, reason: result.error },
          `Couldn't send a ${result.destination} alert about "${alert.newsletterName}": ${result.error}`,
        );
      }
    }
  } catch (err) {
    log.warn({ err }, `Couldn't send an alert about "${alert.newsletterName}"`);
  }
}

// Never throws, like sendFailureAlert. At most one an hour.
export async function sendBackupFailureAlert(db: Db, reason: string, log: Logger): Promise<void> {
  try {
    const config = await loadNotificationSettings(db);
    if (!config.onBackupFailure || (!config.email.enabled && !config.webhook.enabled)) return;
    const last = lastAlertAt.get("backup");
    if (last !== undefined && Date.now() - last < RATE_LIMIT_MS) {
      log.debug("Skipped a repeat backup alert (one per hour)");
      return;
    }
    lastAlertAt.set("backup", Date.now());
    const message = {
      title: "LatestArr: a backup failed",
      body: `${reason}

Open the Backups page in LatestArr for details. Older backups are kept until a new one succeeds.`,
    };
    for (const result of await deliver(db, config, message, null, "backup.failed")) {
      if (result.ok) log.info({ destination: result.destination }, `Sent a ${result.destination} alert about the failed backup`);
      else log.warn({ destination: result.destination, reason: result.error }, `Couldn't send a ${result.destination} alert about the failed backup: ${result.error}`);
    }
  } catch (err) {
    log.warn({ err }, "Couldn't send an alert about the failed backup");
  }
}

export async function sendTestAlert(db: Db, config: NotificationSettings): Promise<DeliveryResult[]> {
  return deliver(
    db,
    config,
    {
      title: "LatestArr: test alert",
      body: "This is a test. LatestArr will alert you here when a scheduled newsletter fails to send.",
    },
    null,
  );
}
