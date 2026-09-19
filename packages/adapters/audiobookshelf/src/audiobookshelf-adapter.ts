import type {
  ConnectionTestResult,
  FetchedImage,
  FetchRecentItemsParams,
  NewItem,
  SourceAdapter,
  SourceConnectionConfig,
  SourceLibrary,
} from "@latestarr/adapter-core";
import {
  buildCoverUrl,
  fetchImage,
  getLibraries,
  getLibraryItems,
  type AudiobookshelfLibraryItem,
} from "./audiobookshelf-client.js";

const DEFAULT_FETCH_COUNT = 100;

// Audiobookshelf's item mediaType is "book" or "podcast" (episode), but our
// MediaKind vocabulary only models "audiobook" — every item this adapter
// returns is mapped to that one MediaKind (a known simplification).
// contentLabel keeps the book/podcast distinction visible in a rendered
// newsletter without widening the shared MediaKind enum for it.
function mapContentLabel(mediaType: string): string {
  return mediaType === "podcast" ? "Podcast" : "Audiobook";
}

function mapItem(item: AudiobookshelfLibraryItem, baseUrl: string, token: string): NewItem {
  const metadata = item.media.metadata;
  return {
    id: item.id,
    externalId: item.id,
    kind: "audiobook",
    contentLabel: mapContentLabel(item.mediaType),
    title: metadata.title,
    subtitle: metadata.authorName,
    overview: metadata.description,
    addedAt: new Date(item.addedAt),
    releaseDate: metadata.publishedYear ? new Date(metadata.publishedYear) : undefined,
    posterUrl: item.media.coverPath ? buildCoverUrl(baseUrl, token, item.id) : undefined,
    raw: item,
  };
}

export const audiobookshelfAdapter: SourceAdapter = {
  kind: "audiobookshelf",
  capabilities: {
    supportsMediaKinds: ["audiobook"],
    supportsIncrementalSync: false,
  },

  async testConnection(config: SourceConnectionConfig): Promise<ConnectionTestResult> {
    try {
      await getLibraries(config.baseUrl, config.credentials.token ?? "");
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Unknown error" };
    }
  },

  async listLibraries(config: SourceConnectionConfig): Promise<SourceLibrary[]> {
    const libraries = await getLibraries(config.baseUrl, config.credentials.token ?? "");
    return libraries.map((library) => ({ id: library.id, name: library.name, kind: "audiobook" }));
  },

  async fetchRecentItems(
    config: SourceConnectionConfig,
    params: FetchRecentItemsParams,
  ): Promise<NewItem[]> {
    if (params.mediaKinds && !params.mediaKinds.includes("audiobook")) {
      return [];
    }

    const token = config.credentials.token ?? "";
    const count = params.limit ?? DEFAULT_FETCH_COUNT;

    // Unlike Tautulli/Plex/BookLore, Audiobookshelf has no global
    // cross-library "recent items" endpoint — items are only queryable
    // per-library, so with no explicit libraryIds filter we first discover
    // every library and loop over all of them.
    const libraryIds =
      params.libraryIds && params.libraryIds.length > 0
        ? params.libraryIds
        : (await getLibraries(config.baseUrl, token)).map((library) => library.id);

    const results: NewItem[] = [];
    for (const libraryId of libraryIds) {
      const items = await getLibraryItems(config.baseUrl, token, libraryId, count);
      for (const item of items) {
        const mapped = mapItem(item, config.baseUrl, token);
        if (mapped.addedAt >= params.since) {
          results.push(mapped);
        }
      }
    }

    return results;
  },

  // config is unused here — posterUrl (built above with buildCoverUrl) is
  // already an absolute, token-bearing URL, so no extra auth is needed at
  // fetch time.
  async fetchImageBytes(_config: SourceConnectionConfig, item: NewItem): Promise<FetchedImage | null> {
    if (!item.posterUrl) return null;
    return fetchImage(item.posterUrl);
  },
};
