import type {
  ConnectionTestResult,
  FetchRecentItemsParams,
  NewItem,
  SourceAdapter,
  SourceConnectionConfig,
  SourceLibrary,
} from "@latestarr/adapter-core";
import { getLibraries, getLibraryItems, type AudiobookshelfLibraryItem } from "./audiobookshelf-client.js";

const DEFAULT_FETCH_COUNT = 100;

function mapItem(item: AudiobookshelfLibraryItem): NewItem {
  const metadata = item.media.metadata;
  return {
    id: item.id,
    externalId: item.id,
    // Audiobookshelf's item mediaType is "book" or "podcast" (episode),
    // but our MediaKind vocabulary only models "audiobook" — every item
    // this adapter returns is mapped to it, a known simplification.
    kind: "audiobook",
    title: metadata.title,
    subtitle: metadata.authorName,
    overview: metadata.description,
    addedAt: new Date(item.addedAt),
    releaseDate: metadata.publishedYear ? new Date(metadata.publishedYear) : undefined,
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
        const mapped = mapItem(item);
        if (mapped.addedAt >= params.since) {
          results.push(mapped);
        }
      }
    }

    return results;
  },
};
