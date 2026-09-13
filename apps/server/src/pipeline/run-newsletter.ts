import { getAdapter, type MediaKind, type NewItem, type SourceAdapter } from "@latestarr/adapter-core";
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
  templates,
} from "@latestarr/db";
import { and, eq, inArray } from "drizzle-orm";
import { sendEmail, type SmtpCredentials } from "../mailer/send.js";
import { renderMjmlTemplate } from "../render/mjml-template.js";
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
type NewsletterSourceLink = typeof newsletterSources.$inferSelect;
type SourceConnectionRow = typeof sourceConnections.$inferSelect;

interface LinkedSource {
  link: NewsletterSourceLink;
  source: SourceConnectionRow;
  adapter: SourceAdapter;
  credentials: Record<string, string>;
}

async function resolveLinkedSources(db: Db, newsletter: Newsletter): Promise<LinkedSource[]> {
  const sourceLinks = await db
    .select()
    .from(newsletterSources)
    .where(eq(newsletterSources.newsletterId, newsletter.id));

  const key = getEncryptionKey();
  const resolved: LinkedSource[] = [];

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
    resolved.push({ link, source, adapter, credentials });
  }

  return resolved;
}

async function fetchItemsForNewsletter(db: Db, newsletter: Newsletter): Promise<NewItem[]> {
  const since = new Date(Date.now() - newsletter.lookbackDays * 24 * 60 * 60 * 1000);
  const linkedSources = await resolveLinkedSources(db, newsletter);
  const allItems: NewItem[] = [];

  for (const { link, source, adapter, credentials } of linkedSources) {
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

// Only called for a newsletter rendering through a custom compiled template
// — a Media List block with sort="mostWatched" is the only consumer of this
// pool, so the hardcoded-template fallback path never pays for it.
async function fetchPopularItemsForNewsletter(db: Db, newsletter: Newsletter): Promise<NewItem[]> {
  const since = new Date(Date.now() - newsletter.lookbackDays * 24 * 60 * 60 * 1000);
  const linkedSources = await resolveLinkedSources(db, newsletter);
  const allItems: NewItem[] = [];

  for (const { link, source, adapter, credentials } of linkedSources) {
    if (!adapter.fetchPopularItems) continue;
    const items = await adapter.fetchPopularItems(
      { baseUrl: source.baseUrl, credentials },
      { since, mediaKinds: link.mediaTypeFilter as MediaKind[] | undefined },
    );
    allItems.push(...items);
  }

  return allItems;
}

async function renderNewsletterContent(
  db: Db,
  newsletter: Newsletter,
  items: NewItem[],
  generatedAt: Date,
): Promise<string> {
  if (newsletter.templateId) {
    const [template] = await db.select().from(templates).where(eq(templates.id, newsletter.templateId));
    if (template?.compiledMjml) {
      // Fetching "most watched" data means extra adapter API calls, so only
      // pay for it when the compiled template actually has a Media List
      // block configured to use that pool.
      const popularItems = template.compiledMjml.includes('sort="mostWatched"')
        ? await fetchPopularItemsForNewsletter(db, newsletter)
        : [];
      return await renderMjmlTemplate(template.compiledMjml, {
        newsletterName: newsletter.name,
        items,
        popularItems,
        generatedAt,
      });
    }
  }

  return renderNewsletterHtml({ newsletterName: newsletter.name, items, generatedAt });
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
    const html = await renderNewsletterContent(db, newsletter, items, new Date());
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
