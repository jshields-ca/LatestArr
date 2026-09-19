import type {
  ConnectionTestResult,
  FetchedImage,
  FetchRecentItemsParams,
  MediaKind,
  NewItem,
  SourceAdapter,
  SourceConnectionConfig,
  SourceLibrary,
} from "@latestarr/adapter-core";
import {
  buildImageUrl,
  fetchImage,
  getLibraries,
  getRecentlyAdded,
  type PlexMetadataItem,
} from "./plex-client.js";

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

// A `tv_episode` item's own `title` is just the episode's name (e.g.
// "Winter Is Coming") — rendered as the prominent title on its own, that
// reads as if the *episode* were the show, with no indication which series
// it belongs to. The series name (`grandparentTitle`) belongs in the
// primary title instead, with the SxxExx/episode-name detail demoted to
// the subtitle.
function buildEpisodeTitle(item: PlexMetadataItem): string {
  return item.grandparentTitle ?? item.title;
}

function buildEpisodeSubtitle(item: PlexMetadataItem): string | undefined {
  if (!item.grandparentTitle) return undefined;
  const season = String(item.parentIndex ?? 0).padStart(2, "0");
  const episode = String(item.index ?? 0).padStart(2, "0");
  return `S${season}E${episode} - ${item.title}`;
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
          title: kind === "tv_episode" ? buildEpisodeTitle(item) : item.title,
          subtitle: kind === "tv_episode" ? buildEpisodeSubtitle(item) : undefined,
          overview: item.summary || undefined,
          addedAt,
          releaseDate: item.originallyAvailableAt ? new Date(item.originallyAvailableAt) : undefined,
          posterUrl: item.thumb ? buildImageUrl(config.baseUrl, token, item.thumb) : undefined,
          raw: item,
        });
      }
    }

    return results;
  },

  // config is unused here — posterUrl (built above with buildImageUrl) is
  // already an absolute, token-bearing URL, so no extra auth is needed at
  // fetch time. It's still part of the signature to satisfy SourceAdapter
  // and to mirror the other adapters, some of which do need it.
  async fetchImageBytes(_config: SourceConnectionConfig, item: NewItem): Promise<FetchedImage | null> {
    if (!item.posterUrl) return null;
    return fetchImage(item.posterUrl);
  },
};
