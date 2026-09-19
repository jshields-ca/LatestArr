import {
  getAdapter,
  type MediaKind,
  type NewItem,
  type SourceAdapter,
  type SourceConnectionConfig,
} from "@latestarr/adapter-core";
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
import { sendEmail, type EmailAttachment, type SmtpCredentials } from "../mailer/send.js";
import { embedPosterImages, type ItemImageSource } from "./embed-images.js";
import { renderMjmlTemplate } from "../render/mjml-template.js";
import { renderDefaultNewsletterHtml } from "../render/newsletter-template.js";
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

// A real send failure (an unreachable source, SMTP rejecting the
// connection, ...) used to bubble out of runNewsletter as a bare thrown
// Error, which the send-now route let fall through to Fastify's default
// error handler — that handler's JSON body puts the generic HTTP reason
// phrase ("Internal Server Error") in `error` and the actual detail in
// `message`, but the frontend only ever reads `error`. The result: a real,
// specific failure (e.g. "fetch failed: connect ECONNREFUSED ...") showed
// up as a useless "Internal Server Error" the moment someone clicked "Send
// now", with the real reason only visible later in Send History. This
// turns that same underlying error into a message worth putting in
// `error` directly.
export function describeSendFailure(err: unknown): string {
  const detail = err instanceof Error ? err.message : String(err);
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|fetch failed/i.test(detail)) {
    return `Could not reach one of this newsletter's connected sources (${detail})`;
  }
  return `Send failed: ${detail}`;
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

interface FetchedItems {
  items: NewItem[];
  /** Maps each item back to the adapter/config it came from, so
   * embed-images.ts can fetch its poster with the right source's own
   * credentials — a newsletter pulling from several linked sources at
   * once means this can't be a single shared config. Keyed by object
   * identity: safe here because every item is a freshly-built object for
   * this one render, never reused or cloned before this map is read. */
  sourceByItem: Map<NewItem, ItemImageSource>;
}

async function fetchRecentItemsFromSources(
  linkedSources: LinkedSource[],
  since: Date,
): Promise<FetchedItems> {
  const items: NewItem[] = [];
  const sourceByItem = new Map<NewItem, ItemImageSource>();

  for (const { link, source, adapter, credentials } of linkedSources) {
    const config: SourceConnectionConfig = { baseUrl: source.baseUrl, credentials };
    const sourceItems = await adapter.fetchRecentItems(config, {
      since,
      mediaKinds: link.mediaTypeFilter as MediaKind[] | undefined,
      libraryIds: link.libraryFilter ?? undefined,
    });
    for (const item of sourceItems) sourceByItem.set(item, { adapter, config });
    items.push(...sourceItems);
  }

  return { items, sourceByItem };
}

// Only called for a newsletter rendering through a custom compiled template
// — a Media List block with sort="mostWatched" is the only consumer of this
// pool, so the hardcoded-template fallback path never pays for it.
async function fetchPopularItemsFromSources(
  linkedSources: LinkedSource[],
  since: Date,
): Promise<FetchedItems> {
  const items: NewItem[] = [];
  const sourceByItem = new Map<NewItem, ItemImageSource>();

  for (const { link, source, adapter, credentials } of linkedSources) {
    if (!adapter.fetchPopularItems) continue;
    const config: SourceConnectionConfig = { baseUrl: source.baseUrl, credentials };
    const sourceItems = await adapter.fetchPopularItems(config, {
      since,
      mediaKinds: link.mediaTypeFilter as MediaKind[] | undefined,
    });
    for (const item of sourceItems) sourceByItem.set(item, { adapter, config });
    items.push(...sourceItems);
  }

  return { items, sourceByItem };
}

// Each content kind's linked source base URL, for a Media List block's
// emptyFallback="link" ("nothing new — go browse the library yourself").
// Cheap: reuses the already-resolved linkedSources, no extra source calls.
function buildSourceLinksByContentType(linkedSources: LinkedSource[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const { link, source, adapter } of linkedSources) {
    const kinds = (link.mediaTypeFilter as MediaKind[] | undefined) ?? adapter.capabilities.supportsMediaKinds;
    for (const kind of kinds) {
      if (!(kind in result)) result[kind] = source.baseUrl;
    }
  }
  return result;
}

interface RenderedNewsletter {
  html: string;
  attachments: EmailAttachment[];
  itemCount: number;
}

async function renderNewsletterContent(
  db: Db,
  newsletter: Newsletter,
  generatedAt: Date,
): Promise<RenderedNewsletter> {
  const since = new Date(Date.now() - newsletter.lookbackDays * 24 * 60 * 60 * 1000);
  const linkedSources = await resolveLinkedSources(db, newsletter);

  const { items, sourceByItem } = await fetchRecentItemsFromSources(linkedSources, since);
  const embeddedAdded = await embedPosterImages(items, (item) => sourceByItem.get(item), "added");

  if (newsletter.templateId) {
    const [template] = await db.select().from(templates).where(eq(templates.id, newsletter.templateId));
    if (template?.compiledMjml) {
      // Fetching "most watched" data, or an all-time fallback pool, means
      // extra adapter API calls — only pay for either when the compiled
      // template actually has a Media List block configured to use it.
      const needsPopular = template.compiledMjml.includes('sort="mostWatched"');
      const needsFallback = template.compiledMjml.includes('emptyFallback="random"');

      const embeddedPopular = needsPopular
        ? await (async () => {
            const popular = await fetchPopularItemsFromSources(linkedSources, since);
            return embedPosterImages(popular.items, (item) => popular.sourceByItem.get(item), "popular");
          })()
        : { items: [], attachments: [] };

      const embeddedFallback = needsFallback
        ? await (async () => {
            // No "since" cutoff — this pool exists specifically for when
            // nothing was added in the lookback window, so it has to look
            // further back than that window to find anything at all.
            const fallback = await fetchRecentItemsFromSources(linkedSources, new Date(0));
            return embedPosterImages(fallback.items, (item) => fallback.sourceByItem.get(item), "fallback");
          })()
        : { items: [], attachments: [] };

      const html = await renderMjmlTemplate(template.compiledMjml, {
        newsletterName: newsletter.name,
        items: embeddedAdded.items,
        popularItems: embeddedPopular.items,
        fallbackItems: embeddedFallback.items,
        sourceLinksByContentType: buildSourceLinksByContentType(linkedSources),
        generatedAt,
      });

      return {
        html,
        attachments: [...embeddedAdded.attachments, ...embeddedPopular.attachments, ...embeddedFallback.attachments],
        itemCount: items.length,
      };
    }
  }

  const html = await renderDefaultNewsletterHtml({
    newsletterName: newsletter.name,
    items: embeddedAdded.items,
    generatedAt,
  });
  return { html, attachments: embeddedAdded.attachments, itemCount: items.length };
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
    const { html, attachments, itemCount } = await renderNewsletterContent(db, newsletter, new Date());
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
          attachments,
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
        itemCountIncluded: itemCount,
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
