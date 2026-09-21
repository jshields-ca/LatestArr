import type {
  ConnectionTestResult,
  FetchedImage,
  FetchRecentItemsParams,
  NewItem,
  SourceAdapter,
  SourceConnectionConfig,
  SourceLibrary,
} from "@latestarr/adapter-core";
import { trimTrailingSlashes, withOrigin } from "@latestarr/adapter-core";
import {
  fetchOpdsImage,
  getEntryAuthorName,
  getEntryFormatLabel,
  getEntryImageHref,
  getEntryPermalinkHref,
  getEntrySummaryText,
  getLibraries,
  getRecentEntries,
  resolveOpdsUrl,
  type OpdsEntry,
} from "./booklore-client.js";

const DEFAULT_FETCH_COUNT = 100;

// The address a recipient's browser should actually open — publicUrl when
// the source connection has one configured (this server's own baseUrl may
// be a Tailscale/LAN address), falling back to baseUrl otherwise, which
// matches this adapter's behavior before externalUrl existed at all (no
// link rendered) as closely as a same-host link can.
function resolveWebUrl(config: SourceConnectionConfig): string {
  return config.publicUrl ?? config.baseUrl;
}

// An entry's own OPDS permalink (rel="alternate"/"self") is the most
// specific link this feed can offer, but its href is resolved against
// baseUrl — the internal address the feed itself was served from — so it's
// rebased onto webUrl's origin before being handed out. Falls back to the
// library root when the entry carries no permalink at all (some OPDS
// servers omit it), which is still strictly better than no link.
function buildExternalUrl(entry: OpdsEntry, baseUrl: string, webUrl: string): string {
  const permalinkHref = getEntryPermalinkHref(entry);
  if (permalinkHref) {
    return withOrigin(resolveOpdsUrl(baseUrl, permalinkHref), webUrl);
  }
  return trimTrailingSlashes(webUrl);
}

function mapEntry(entry: OpdsEntry, baseUrl: string, webUrl: string): NewItem {
  // See the OpdsEntry["dc:issued"] type comment: this can arrive as a
  // number (e.g. a bare year like 2020) when the source text node is
  // purely numeric, and `new Date(2020)` would misinterpret that as a
  // millisecond timestamp rather than the year 2020.
  const issued = entry["dc:issued"] !== undefined ? String(entry["dc:issued"]) : undefined;
  const imageHref = getEntryImageHref(entry);
  return {
    id: entry.id,
    externalId: entry.id,
    kind: "book",
    contentLabel: getEntryFormatLabel(entry),
    title: entry.title,
    subtitle: getEntryAuthorName(entry),
    overview: getEntrySummaryText(entry),
    // OPDS entries are required by the underlying Atom spec to carry
    // <updated>, but have no dedicated "added to library" field — this is
    // the closest reliable proxy, and it's exactly what populates the
    // dedicated /recent feed we read from.
    addedAt: entry.updated ? new Date(entry.updated) : new Date(0),
    releaseDate: issued ? new Date(issued) : undefined,
    // Resolved to an absolute URL, but unlike Plex/Tautulli/Audiobookshelf
    // this carries no credentials — OPDS covers sit behind the same HTTP
    // Basic Auth as the feed itself, which fetchImageBytes below supplies
    // at fetch time rather than embedding it in the URL.
    posterUrl: imageHref ? resolveOpdsUrl(baseUrl, imageHref) : undefined,
    externalUrl: buildExternalUrl(entry, baseUrl, webUrl),
    raw: entry,
  };
}

// BookLore, BookOrbit, and Grimmory are compatible forks that expose the
// same OPDS catalog surface — so unlike a typical "shared base client with
// per-fork overrides" split, nothing here actually differs between them
// beyond which `kind` string identifies the connection. See the package
// README-equivalent context in source-adapter tests for why this is a
// single factory rather than three near-duplicate classes.
export function createBookloreFamilyAdapter(kind: string): SourceAdapter {
  return {
    kind,
    capabilities: {
      supportsMediaKinds: ["book"],
      supportsIncrementalSync: false,
    },

    async testConnection(config: SourceConnectionConfig): Promise<ConnectionTestResult> {
      try {
        await getLibraries(config.baseUrl, config.credentials.username ?? "", config.credentials.password ?? "");
        return { ok: true };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : "Unknown error" };
      }
    },

    async listLibraries(config: SourceConnectionConfig): Promise<SourceLibrary[]> {
      const entries = await getLibraries(
        config.baseUrl,
        config.credentials.username ?? "",
        config.credentials.password ?? "",
      );
      return entries.map((entry) => ({ id: entry.id, name: entry.title, kind: "book" }));
    },

    async fetchRecentItems(
      config: SourceConnectionConfig,
      params: FetchRecentItemsParams,
    ): Promise<NewItem[]> {
      // Every item this adapter can return is a book, so a mediaKinds
      // filter that excludes "book" entirely means nothing qualifies.
      if (params.mediaKinds && !params.mediaKinds.includes("book")) {
        return [];
      }

      // OPDS's dedicated "recently added" feed (/api/v1/opds/recent) has no
      // per-library variant in BookLore's documented integration surface,
      // so libraryIds can't be honored here the way the Tautulli/Plex
      // adapters scope per-section — this always reads the whole catalog.
      const entries = await getRecentEntries(
        config.baseUrl,
        config.credentials.username ?? "",
        config.credentials.password ?? "",
        params.limit ?? DEFAULT_FETCH_COUNT,
      );

      const webUrl = resolveWebUrl(config);
      return entries
        .map((entry) => mapEntry(entry, config.baseUrl, webUrl))
        .filter((item) => item.addedAt >= params.since);
    },

    async fetchImageBytes(config: SourceConnectionConfig, item: NewItem): Promise<FetchedImage | null> {
      if (!item.posterUrl) return null;
      return fetchOpdsImage(
        item.posterUrl,
        config.credentials.username ?? "",
        config.credentials.password ?? "",
      );
    },
  };
}

export const bookloreAdapter = createBookloreFamilyAdapter("booklore");
export const bookOrbitAdapter = createBookloreFamilyAdapter("bookorbit");
export const grimmoryAdapter = createBookloreFamilyAdapter("grimmory");
