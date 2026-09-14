import type {
  ConnectionTestResult,
  FetchRecentItemsParams,
  MediaKind,
  NewItem,
  SourceAdapter,
  SourceConnectionConfig,
  SourceLibrary,
} from "@latestarr/adapter-core";
import { getLibraries, getRecentlyAdded, type PlexMetadataItem } from "./plex-client.js";

const DEFAULT_FETCH_COUNT = 100;

function mapMediaType(type: string): MediaKind | null {
  switch (type) {
    case "movie":
      return "movie";
    case "episode":
      return "tv_episode";
    case "season":
      return "tv_season";
    default:
      // Plex's recently-added feed also emits show/artist/album/track/photo
      // entries we don't model yet; skip rather than mis-map them.
      return null;
  }
}

function mapLibraryType(sectionType: string): MediaKind {
  return sectionType === "show" ? "tv_episode" : "movie";
}

function buildEpisodeSubtitle(item: PlexMetadataItem): string | undefined {
  if (!item.grandparentTitle) return undefined;
  const season = String(item.parentIndex ?? 0).padStart(2, "0");
  const episode = String(item.index ?? 0).padStart(2, "0");
  return `${item.grandparentTitle} - S${season}E${episode} - ${item.title}`;
}

export const plexAdapter: SourceAdapter = {
  kind: "plex",
  capabilities: {
    supportsMediaKinds: ["movie", "tv_episode", "tv_season"],
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
    return libraries.map((library) => ({
      id: library.key,
      name: library.title,
      kind: mapLibraryType(library.type),
    }));
  },

  async fetchRecentItems(
    config: SourceConnectionConfig,
    params: FetchRecentItemsParams,
  ): Promise<NewItem[]> {
    const token = config.credentials.token ?? "";
    const count = params.limit ?? DEFAULT_FETCH_COUNT;
    // Plex's recentlyAdded is per-library when scoped, so a multi-library
    // filter means one request per library, merged below — same shape as
    // the Tautulli adapter's equivalent loop.
    const sectionKeys =
      params.libraryIds && params.libraryIds.length > 0 ? params.libraryIds : [undefined];

    const results: NewItem[] = [];
    for (const sectionKey of sectionKeys) {
      const items = await getRecentlyAdded(config.baseUrl, token, count, sectionKey);
      for (const item of items) {
        const kind = mapMediaType(item.type);
        if (!kind) continue;
        if (params.mediaKinds && !params.mediaKinds.includes(kind)) continue;

        const addedAt = new Date(item.addedAt * 1000);
        // recentlyAdded has no server-side "since" filter — it's sorted by
        // most-recently-added, so we page in `count` items and cut here.
        if (addedAt < params.since) continue;

        results.push({
          id: item.ratingKey,
          externalId: item.ratingKey,
          kind,
          title: item.title,
          subtitle: kind === "tv_episode" ? buildEpisodeSubtitle(item) : undefined,
          overview: item.summary || undefined,
          addedAt,
          releaseDate: item.originallyAvailableAt ? new Date(item.originallyAvailableAt) : undefined,
          raw: item,
        });
      }
    }

    return results;
  },
};
