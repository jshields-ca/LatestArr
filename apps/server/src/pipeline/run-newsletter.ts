import { getAdapter, type MediaKind, type NewItem } from "@latestarr/adapter-core";
import { decrypt } from "@latestarr/crypto";
import {
  type Db,
  newsletterRecipientGroups,
  newsletterSources,
  newsletters,
  recipientGroupMembers,
  recipients,
  sendRunRecipientResults,
  sendRuns,
  smtpProfiles,
  sourceConnections,
} from "@latestarr/db";
import { and, eq, inArray } from "drizzle-orm";
import { sendEmail, type SmtpCredentials } from "../mailer/send.js";
import { renderNewsletterHtml } from "../render/newsletter-template.js";
import { getEncryptionKey } from "../secrets.js";

export class NewsletterNotFoundError extends Error {
  constructor(id: string) {
    super(`Newsletter ${id} not found`);
    this.name = "NewsletterNotFoundError";
  }
}

export class NewsletterMisconfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NewsletterMisconfiguredError";
  }
}

export class SendAlreadyRunningError extends Error {
  constructor() {
    super("A send is already running for this newsletter");
    this.name = "SendAlreadyRunningError";
  }
}

type Newsletter = typeof newsletters.$inferSelect;

async function fetchItemsForNewsletter(db: Db, newsletter: Newsletter): Promise<NewItem[]> {
  const sourceLinks = await db
    .select()
    .from(newsletterSources)
    .where(eq(newsletterSources.newsletterId, newsletter.id));

  const since = new Date(Date.now() - newsletter.lookbackDays * 24 * 60 * 60 * 1000);
  const key = getEncryptionKey();
  const allItems: NewItem[] = [];

  for (const link of sourceLinks) {
    const [source] = await db
      .select()
      .from(sourceConnections)
      .where(eq(sourceConnections.id, link.sourceConnectionId));
    if (!source) continue;

    const adapter = getAdapter(source.kind);
    if (!adapter) continue;

    const credentials = JSON.parse(decrypt(source.credentialsEncrypted, key)) as Record<
      string,
      string
    >;
    const items = await adapter.fetchRecentItems(
      { baseUrl: source.baseUrl, credentials },
      {
        since,
        mediaKinds: link.mediaTypeFilter as MediaKind[] | undefined,
        libraryIds: link.libraryFilter ?? undefined,
      },
    );
    allItems.push(...items);
  }

  return allItems;
}

async function resolveRecipients(db: Db, newsletterId: string) {
  const groupLinks = await db
    .select()
    .from(newsletterRecipientGroups)
    .where(eq(newsletterRecipientGroups.newsletterId, newsletterId));
  const groupIds = groupLinks.map((link) => link.groupId);
  if (groupIds.length === 0) return [];

  const rows = await db
    .select({ recipient: recipients })
    .from(recipientGroupMembers)
    .innerJoin(recipients, eq(recipientGroupMembers.recipientId, recipients.id))
    .where(inArray(recipientGroupMembers.groupId, groupIds));

  const byId = new Map<string, (typeof rows)[number]["recipient"]>();
  for (const row of rows) {
    byId.set(row.recipient.id, row.recipient);
  }
  return [...byId.values()];
}

export async function runNewsletter(db: Db, newsletterId: string): Promise<{ sendRunId: string }> {
  const [newsletter] = await db.select().from(newsletters).where(eq(newsletters.id, newsletterId));
  if (!newsletter) {
    throw new NewsletterNotFoundError(newsletterId);
  }
  if (!newsletter.smtpProfileId) {
    throw new NewsletterMisconfiguredError("Newsletter has no SMTP profile configured");
  }

  const [smtpProfile] = await db
    .select()
    .from(smtpProfiles)
    .where(eq(smtpProfiles.id, newsletter.smtpProfileId));
  if (!smtpProfile) {
    throw new NewsletterMisconfiguredError("Configured SMTP profile no longer exists");
  }

  const runningRuns = await db
    .select()
    .from(sendRuns)
    .where(and(eq(sendRuns.newsletterId, newsletterId), eq(sendRuns.status, "running")));
  if (runningRuns.length > 0) {
    throw new SendAlreadyRunningError();
  }

  const [sendRun] = await db
    .insert(sendRuns)
    .values({ newsletterId, status: "running", startedAt: new Date() })
    .returning();
  const sendRunId = sendRun!.id;

  try {
    const items = await fetchItemsForNewsletter(db, newsletter);
    const html = renderNewsletterHtml({
      newsletterName: newsletter.name,
      items,
      generatedAt: new Date(),
    });
    const subject = newsletter.subjectTemplate || newsletter.name;

    const recipientRows = await resolveRecipients(db, newsletterId);
    const activeRecipients = recipientRows.filter((recipient) => recipient.isActive);

    const key = getEncryptionKey();
    const smtpCredentials: SmtpCredentials = {
      host: smtpProfile.host,
      port: smtpProfile.port,
      secure: smtpProfile.secure,
      user: smtpProfile.authUserEncrypted ? decrypt(smtpProfile.authUserEncrypted, key) : undefined,
      pass: smtpProfile.authPassEncrypted ? decrypt(smtpProfile.authPassEncrypted, key) : undefined,
    };

    const fromName = newsletter.senderIdentity?.fromName ?? smtpProfile.defaultFromName;
    const fromEmail = newsletter.senderIdentity?.fromEmail ?? smtpProfile.defaultFromEmail;

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of activeRecipients) {
      try {
        const result = await sendEmail(smtpCredentials, {
          from: `${fromName} <${fromEmail}>`,
          to: recipient.email,
          subject,
          html,
        });
        await db.insert(sendRunRecipientResults).values({
          sendRunId,
          recipientId: recipient.id,
          status: "sent",
          providerMessageId: result.messageId,
        });
        sentCount++;
      } catch (err) {
        await db.insert(sendRunRecipientResults).values({
          sendRunId,
          recipientId: recipient.id,
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        });
        failedCount++;
      }
    }

    const finalStatus =
      failedCount === 0 ? "success" : sentCount === 0 && failedCount > 0 ? "failed" : "partial_failure";

    await db
      .update(sendRuns)
      .set({
        status: finalStatus,
        finishedAt: new Date(),
        itemCountIncluded: items.length,
        recipientCount: activeRecipients.length,
      })
      .where(eq(sendRuns.id, sendRunId));

    return { sendRunId };
  } catch (err) {
    await db
      .update(sendRuns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        error: err instanceof Error ? err.message : "Unknown error",
      })
      .where(eq(sendRuns.id, sendRunId));
    throw err;
  }
}
