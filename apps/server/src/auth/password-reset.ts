import { createHash, randomBytes } from "node:crypto";
import { type Db, passwordResetTokens, settings, smtpProfiles, users } from "@latestarr/db";
import { and, eq, gt } from "drizzle-orm";
import type { Logger } from "../logger.js";
import { smtpCredentialsFor } from "../mailer/credentials.js";
import { sendEmail } from "../mailer/send.js";

// "Forgot password?" links: random, single-use, stored only as a hash, and
// short-lived. Asking again replaces any earlier link, and an account gets
// at most one email every RESEND_COOLDOWN_MS however often someone asks.
export const RESET_TTL_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_MS = 2 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Issues a new reset token for the user, cancelling any earlier ones. */
export function createResetToken(db: Db, userId: string): string {
  const token = randomBytes(32).toString("base64url");
  db.transaction((tx) => {
    tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId)).run();
    tx.insert(passwordResetTokens)
      .values({ id: hashToken(token), userId, expiresAt: new Date(Date.now() + RESET_TTL_MS) })
      .run();
  });
  return token;
}

/** Whether a link was sent to this user too recently to send another. */
export function recentlySent(db: Db, userId: string): boolean {
  const since = new Date(Date.now() - RESEND_COOLDOWN_MS);
  return (
    db
      .select({ id: passwordResetTokens.id })
      .from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.userId, userId), gt(passwordResetTokens.createdAt, since)))
      .all().length > 0
  );
}

/**
 * Uses up a reset token. Returns its user's id, or null if the token is
 * unknown, already used, or expired. Either way the token stops working.
 */
export function consumeResetToken(db: Db, token: string): string | null {
  const id = hashToken(token);
  return db.transaction((tx) => {
    const row = tx.select().from(passwordResetTokens).where(eq(passwordResetTokens.id, id)).get();
    if (!row) return null;
    tx.delete(passwordResetTokens).where(eq(passwordResetTokens.id, id)).run();
    return row.expiresAt.getTime() > Date.now() ? row.userId : null;
  });
}

/** Cancels a user's outstanding reset links, e.g. once their password changes. */
export function clearResetTokens(db: Db, userId: string): void {
  db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId)).run();
}

// The SMTP profile LatestArr uses for its own email (reset links), chosen on
// the SMTP Profiles page. Kept in the settings table.
const SYSTEM_MAIL_KEY = "systemMail";

export interface SystemMailSettings {
  smtpProfileId: string | null;
}

export function loadSystemMail(db: Db): SystemMailSettings {
  const row = db.select().from(settings).where(eq(settings.key, SYSTEM_MAIL_KEY)).get();
  const value = row?.value as Partial<SystemMailSettings> | undefined;
  return { smtpProfileId: typeof value?.smtpProfileId === "string" ? value.smtpProfileId : null };
}

export function saveSystemMail(db: Db, value: SystemMailSettings): void {
  db.insert(settings)
    .values({ key: SYSTEM_MAIL_KEY, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

/** The system mail profile, if one is chosen and still exists. */
function systemMailProfile(db: Db) {
  const { smtpProfileId } = loadSystemMail(db);
  if (!smtpProfileId) return undefined;
  return db.select().from(smtpProfiles).where(eq(smtpProfiles.id, smtpProfileId)).get();
}

export type ResetUnavailableReason = "no_system_mail" | "no_web_origin" | "origin_mismatch";

/**
 * Where reset links point, or why email resets are off. Links always use
 * WEB_ORIGIN, never the request's own Host header (which a client controls).
 * When the address someone is using doesn't match WEB_ORIGIN (typically a
 * reverse proxy in front of an install still set to localhost), a link
 * would be broken, so resets are off until WEB_ORIGIN is fixed.
 */
export function resetLinkOrigin(
  db: Db,
  requestHost: string,
  webOrigin = process.env.WEB_ORIGIN,
): { origin: string } | { unavailable: ResetUnavailableReason } {
  if (!systemMailProfile(db)) return { unavailable: "no_system_mail" };
  let origin: URL;
  try {
    origin = new URL(webOrigin ?? "");
  } catch {
    return { unavailable: "no_web_origin" };
  }
  // Parsed the same way, so a default port matches either way
  // ("example.com:443" and "https://example.com").
  let requested: URL;
  try {
    requested = new URL(`${origin.protocol}//${requestHost}`);
  } catch {
    return { unavailable: "origin_mismatch" };
  }
  if (requested.host !== origin.host) return { unavailable: "origin_mismatch" };
  return { origin: origin.origin };
}

/**
 * Emails a reset link. The token goes in the URL's fragment (after #), which
 * browsers never send to a server, so it can't end up in an access log or
 * a proxy's logs.
 */
export async function sendResetEmail(
  db: Db,
  user: typeof users.$inferSelect,
  token: string,
  origin: string,
  log: Logger,
): Promise<void> {
  const profile = systemMailProfile(db);
  if (!profile) return;
  const link = `${origin}/reset-password#token=${token}`;
  const minutes = RESET_TTL_MS / 60_000;
  const text = [
    `Someone asked to reset the password for ${user.email} on LatestArr.`,
    "",
    `Choose a new password here (the link works once, for ${minutes} minutes):`,
    link,
    "",
    "If that wasn't you, ignore this email. Your password stays the same.",
  ].join("\n");
  const html = `<p>Someone asked to reset the password for <strong>${escapeHtml(user.email)}</strong> on LatestArr.</p>
<p><a href="${escapeHtml(link)}">Choose a new password</a>. The link works once, for ${minutes} minutes.</p>
<p>If that wasn't you, ignore this email. Your password stays the same.</p>`;
  try {
    await sendEmail(smtpCredentialsFor(profile), {
      from: `${profile.defaultFromName} <${profile.defaultFromEmail}>`,
      to: user.email,
      subject: "Reset your LatestArr password",
      html,
      text,
    });
    log.info({ userId: user.id }, `Sent a password reset link to ${user.email}`);
  } catch (err) {
    log.error({ err, userId: user.id }, `Couldn't send a password reset link to ${user.email} using SMTP profile "${profile.name}"`);
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
