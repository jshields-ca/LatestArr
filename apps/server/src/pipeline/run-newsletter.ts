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
import {
  preparePosterPlaceholders,
  resolvePosterPlaceholders,
  type ItemImageSource,
} from "./embed-images.js";
import { renderMjmlTemplate } from "../render/mjml-template.js";
import { renderDefaultNewsletterHtml } from "../render/newsletter-template.js";
import { logger as defaultLogger, type Logger } from "../logger.js";
import { getEncryptionKey } from "../secrets.js";

export type SendTrigger = "manual" | "scheduled" | "catch-up";

export interface RunNewsletterOptions {
  trigger?: SendTrigger;
  log?: Logger;
}

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

async function resolveLinkedSources(db: Db, newsletter: Newsletter, log: Logger): Promise<LinkedSource[]> {
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
    if (!adapter) {
      log.warn(
        { sourceId: source.id, kind: source.kind },
        `Skipped source "${source.name}": this version of LatestArr doesn't support "${source.kind}" sources`,
      );
      continue;
    }

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

// Names the source in the log before the error propagates — the send's own
// failure line only carries the adapter's message (often just "fetch
// failed"), which doesn't say which of several linked sources broke.
async function fetchFromSource<T>(log: Logger, source: SourceConnectionRow, fetch: () => Promise<T>): Promise<T> {
  try {
    return await fetch();
  } catch (err) {
    log.warn({ err, sourceId: source.id }, `Couldn't fetch from source "${source.name}"`);
    throw err;
  }
}

async function fetchRecentItemsFromSources(
  linkedSources: LinkedSource[],
  since: Date,
  log: Logger,
): Promise<FetchedItems> {
  const items: NewItem[] = [];
  const sourceByItem = new Map<NewItem, ItemImageSource>();

  for (const { link, source, adapter, credentials } of linkedSources) {
    const config: SourceConnectionConfig = {
      baseUrl: source.baseUrl,
      publicUrl: source.publicUrl ?? undefined,
      credentials,
    };
    const sourceItems = await fetchFromSource(log, source, () =>
      adapter.fetchRecentItems(config, {
        since,
        mediaKinds: link.mediaTypeFilter as MediaKind[] | undefined,
        libraryIds: link.libraryFilter ?? undefined,
      }),
    );
    log.debug({ sourceId: source.id, count: sourceItems.length }, `Fetched ${sourceItems.length} items from "${source.name}"`);
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
  log: Logger,
): Promise<FetchedItems> {
  const items: NewItem[] = [];
  const sourceByItem = new Map<NewItem, ItemImageSource>();

  for (const { link, source, adapter, credentials } of linkedSources) {
    const fetchPopular = adapter.fetchPopularItems;
    if (!fetchPopular) continue;
    const config: SourceConnectionConfig = {
      baseUrl: source.baseUrl,
      publicUrl: source.publicUrl ?? undefined,
      credentials,
    };
    const sourceItems = await fetchFromSource(log, source, () =>
      fetchPopular.call(adapter, config, {
        since,
        mediaKinds: link.mediaTypeFilter as MediaKind[] | undefined,
      }),
    );
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
    // publicUrl (when set) is the address a recipient can actually reach —
    // baseUrl may be an internal/API-only host (see the source_connections
    // schema comment), so it's only the fallback here, not the default.
    const href = source.publicUrl ?? source.baseUrl;
    for (const kind of kinds) {
      if (!(kind in result)) result[kind] = href;
    }
  }
  return result;
}

interface RenderedNewsletter {
  html: string;
  attachments: EmailAttachment[];
  /** The fetched pool this render drew from — same set `itemCountIncluded`
   * has always counted (its `.length`), now also captured as a
   * {title, kind} snapshot for send-run detail. For a custom template
   * with per-block selection (Media List's count/sort/emptyFallback), this
   * can be a superset of what the template actually rendered — an
   * existing characteristic of itemCountIncluded this doesn't change,
   * just extends to also record titles. */
  items: NewItem[];
}

const EMPTY_FETCHED_ITEMS: FetchedItems = { items: [], sourceByItem: new Map() };

async function renderNewsletterContent(
  db: Db,
  newsletter: Newsletter,
  generatedAt: Date,
  log: Logger,
): Promise<RenderedNewsletter> {
  const since = new Date(Date.now() - newsletter.lookbackDays * 24 * 60 * 60 * 1000);
  const linkedSources = await resolveLinkedSources(db, newsletter, log);
  if (linkedSources.length === 0) {
    log.warn(`Newsletter "${newsletter.name}" has no usable sources linked, so it will have no items`);
  }

  const { items, sourceByItem } = await fetchRecentItemsFromSources(linkedSources, since, log);
  // Real posterUrls are swapped for opaque placeholder tokens *before* any
  // template rendering happens — see embed-images.ts's own doc comment for
  // why: a Media List block's count/order/showAll/emptyFallback selection
  // (in mjml-template.ts's `mediaList` helper) can pick as few as 5 items
  // out of a much larger fetched pool, and eagerly embedding every
  // fetched item's poster (rather than only the ones actually rendered)
  // wastes fetches/resizes on images that never appear in the sent email
  // — exactly the "keep message size sane" goal CID embedding exists for.
  const addedPlaceholders = preparePosterPlaceholders(items);

  if (newsletter.templateId) {
    const [template] = await db.select().from(templates).where(eq(templates.id, newsletter.templateId));
    if (template?.compiledMjml) {
      // Fetching "most watched" data, or an all-time fallback pool, means
      // extra adapter API calls — only pay for either when the compiled
      // template actually has a Media List block configured to use it,
      // and run both concurrently rather than one after the other since
      // neither depends on the other's result.
      const needsPopular = template.compiledMjml.includes('sort="mostWatched"');
      const needsFallback = template.compiledMjml.includes('emptyFallback="random"');

      const [popular, fallback] = await Promise.all([
        needsPopular ? fetchPopularItemsFromSources(linkedSources, since, log) : Promise.resolve(EMPTY_FETCHED_ITEMS),
        // No "since" cutoff for the fallback pool — it exists specifically
        // for when nothing was added in the lookback window, so it has to
        // look further back than that window to find anything at all.
        needsFallback
          ? fetchRecentItemsFromSources(linkedSources, new Date(0), log)
          : Promise.resolve(EMPTY_FETCHED_ITEMS),
      ]);

      const popularPlaceholders = preparePosterPlaceholders(popular.items);
      const fallbackPlaceholders = preparePosterPlaceholders(fallback.items);

      const html = await renderMjmlTemplate(template.compiledMjml, {
        newsletterName: newsletter.name,
        items: addedPlaceholders.items,
        popularItems: popularPlaceholders.items,
        fallbackItems: fallbackPlaceholders.items,
        sourceLinksByContentType: buildSourceLinksByContentType(linkedSources),
        generatedAt,
        introText: newsletter.introText ?? undefined,
        footerNote: newsletter.footerNote ?? undefined,
        ctas: newsletter.ctas ?? undefined,
      });

      // Only *now*, once the template has already decided which items it
      // actually shows, do we look up which placeholder tokens made it
      // into the output and fetch/embed images for just those.
      const allPlaceholders = new Map([
        ...addedPlaceholders.placeholders,
        ...popularPlaceholders.placeholders,
        ...fallbackPlaceholders.placeholders,
      ]);
      const allSourceByItem = new Map([...sourceByItem, ...popular.sourceByItem, ...fallback.sourceByItem]);
      const resolved = await resolvePosterPlaceholders(html, allPlaceholders, (item) =>
        allSourceByItem.get(item),
      );

      return { html: resolved.html, attachments: resolved.attachments, items };
    }
  }

  // The default template has no per-block selection to wait on (it shows
  // every fetched item, uncapped) — but it still goes through the same
  // placeholder round-trip, both to share one code path and because it's
  // no less correct here: only posters that actually end up in the output
  // get fetched.
  const html = await renderDefaultNewsletterHtml({
    newsletterName: newsletter.name,
    items: addedPlaceholders.items,
    generatedAt,
    lookbackDays: newsletter.lookbackDays,
    emailFont: newsletter.emailFont,
    introText: newsletter.introText ?? undefined,
    footerNote: newsletter.footerNote ?? undefined,
    ctas: newsletter.ctas ?? undefined,
  });
  const resolved = await resolvePosterPlaceholders(html, addedPlaceholders.placeholders, (item) =>
    sourceByItem.get(item),
  );
  return { html: resolved.html, attachments: resolved.attachments, items };
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

interface RunContext {
  name?: string;
  sendRunId?: string;
}

// Logs every outcome of a send exactly once, whoever triggered it (the
// send-now route, a cron tick, or the startup catch-up), so callers don't
// need their own failure logging.
export async function runNewsletter(
  db: Db,
  newsletterId: string,
  options: RunNewsletterOptions = {},
): Promise<{ sendRunId: string }> {
  const log = (options.log ?? defaultLogger).child({ newsletterId, trigger: options.trigger ?? "manual" });
  const context: RunContext = {};
  try {
    return await executeRun(db, newsletterId, log, context);
  } catch (err) {
    const label = context.name ? `"${context.name}"` : newsletterId;
    if (
      err instanceof NewsletterNotFoundError ||
      err instanceof NewsletterMisconfiguredError ||
      err instanceof SendAlreadyRunningError
    ) {
      log.warn(`Didn't send newsletter ${label}: ${err.message}`);
    } else {
      log.error({ err, sendRunId: context.sendRunId }, `Newsletter ${label} failed to send: ${describeSendFailure(err)}`);
    }
    throw err;
  }
}

async function executeRun(
  db: Db,
  newsletterId: string,
  baseLog: Logger,
  context: RunContext,
): Promise<{ sendRunId: string }> {
  const startedAt = Date.now();
  const [newsletter] = await db.select().from(newsletters).where(eq(newsletters.id, newsletterId));
  if (!newsletter) {
    throw new NewsletterNotFoundError(newsletterId);
  }
  context.name = newsletter.name;
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
  context.sendRunId = sendRunId;
  const log = baseLog.child({ sendRunId });
  log.info(`Sending newsletter "${newsletter.name}"`);

  try {
    const { html, attachments, items } = await renderNewsletterContent(db, newsletter, new Date(), log);
    const subject = newsletter.subjectTemplate || newsletter.name;

    // Persisted as soon as rendering succeeds, independent of whether the
    // send-loop below ends up sent/partial_failure/failed for individual
    // recipients — "what was sent" is meaningful even if delivery to some
    // (or all) recipients later failed.
    await db
      .update(sendRuns)
      .set({
        itemsSnapshot: items.map((item) => ({ title: item.title, kind: item.kind })),
        renderedHtml: html,
      })
      .where(eq(sendRuns.id, sendRunId));

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
        log.warn({ err, recipientId: recipient.id }, `Couldn't deliver "${newsletter.name}" to ${recipient.email}`);
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

    const summary = {
      status: finalStatus,
      sent: sentCount,
      failed: failedCount,
      items: items.length,
      durationMs: Date.now() - startedAt,
    };
    const total = activeRecipients.length;
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
    if (total === 0) {
      log.warn(summary, `Newsletter "${newsletter.name}" has no active recipients, so nothing was sent`);
    } else if (finalStatus === "success") {
      log.info(summary, `Sent "${newsletter.name}" to ${plural(sentCount, "recipient")} (${plural(items.length, "item")})`);
    } else if (finalStatus === "partial_failure") {
      log.warn(summary, `Sent "${newsletter.name}" to ${sentCount} of ${total} recipients; ${failedCount} failed`);
    } else {
      log.error(summary, `Couldn't deliver "${newsletter.name}" to any of its ${plural(total, "recipient")}`);
    }

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
