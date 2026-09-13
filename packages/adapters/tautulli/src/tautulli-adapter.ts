import type {
  ConnectionTestResult,
  FetchPopularItemsParams,
  FetchRecentItemsParams,
  MediaKind,
  NewItem,
  SourceAdapter,
  SourceConnectionConfig,
  SourceLibrary,
} from "@latestarr/adapter-core";
import { getHomeStats, getLibraries, getRecentlyAdded, type TautulliHomeStatRow } from "./tautulli-client.js";

const DEFAULT_FETCH_COUNT = 100;

// get_home_stats has no per-media-kind stat for "tv_season" — Tautulli
// groups all TV watch stats (episode or season plays alike) under "top_tv".
const POPULAR_STAT_IDS_BY_KIND: Partial<Record<MediaKind, string>> = {
  movie: "top_movies",
  tv_episode: "top_tv",
  tv_season: "top_tv",
};

function mapHomeStatMediaType(mediaType: string): MediaKind | null {
  switch (mediaType) {
    case "movie":
      return "movie";
    case "episode":
    case "show":
      return "tv_episode";
    default:
      return null;
  }
}

function mapMediaType(mediaType: string): MediaKind | null {
  switch (mediaType) {
    case "movie":
      return "movie";
    case "episode":
      return "tv_episode";
    case "season":
      return "tv_season";
    default:
      // Tautulli's recently-added feed also emits show/artist/album/track
      // entries we don't model yet; skip rather than mis-map them.
      return null;
  }
}

function mapLibraryType(sectionType: string): MediaKind {
  return sectionType === "show" ? "tv_episode" : "movie";
}

function mapHomeStatRow(row: TautulliHomeStatRow): NewItem | null {
  const kind = mapHomeStatMediaType(row.media_type);
  if (!kind) return null;

  return {
    id: row.rating_key,
    externalId: row.rating_key,
    kind,
    title: row.title,
    // get_home_stats rows have no "added" date — last_play is the closest
    // meaningful timestamp available for a most-watched list.
    addedAt: row.last_play ? new Date(Number(row.last_play) * 1000) : new Date(0),
    playCount: row.total_plays,
    uniqueViewerCount: row.users_watched,
    raw: row,
  };
}

export const tautulliAdapter: SourceAdapter = {
  kind: "tautulli",
  capabilities: {
    supportsMediaKinds: ["movie", "tv_episode", "tv_season"],
    supportsIncrementalSync: false,
  },

  async testConnection(config: SourceConnectionConfig): Promise<ConnectionTestResult> {
    try {
      await getLibraries(config.baseUrl, config.credentials.apiKey ?? "");
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Unknown error" };
    }
  },

  async listLibraries(config: SourceConnectionConfig): Promise<SourceLibrary[]> {
    const libraries = await getLibraries(config.baseUrl, config.credentials.apiKey ?? "");
    return libraries.map((library) => ({
      id: library.section_id,
      name: library.section_name,
      kind: mapLibraryType(library.section_type),
    }));
  },

  async fetchRecentItems(
    config: SourceConnectionConfig,
    params: FetchRecentItemsParams,
  ): Promise<NewItem[]> {
    const apiKey = config.credentials.apiKey ?? "";
    const count = params.limit ?? DEFAULT_FETCH_COUNT;
    // Tautulli's get_recently_added only accepts one section_id per call, so
    // a multi-library filter means one request per library, merged below.
    const sectionIds =
      params.libraryIds && params.libraryIds.length > 0 ? params.libraryIds : [undefined];

    const results: NewItem[] = [];
    for (const sectionId of sectionIds) {
      const items = await getRecentlyAdded(config.baseUrl, apiKey, count, sectionId);
      for (const item of items) {
        const kind = mapMediaType(item.media_type);
        if (!kind) continue;
        if (params.mediaKinds && !params.mediaKinds.includes(kind)) continue;

        const addedAt = new Date(Number(item.added_at) * 1000);
        // get_recently_added has no server-side "since" filter — it's sorted
        // by most-recently-added, so we page in `count` items and cut here.
        if (addedAt < params.since) continue;

        results.push({
          id: item.rating_key,
          externalId: item.rating_key,
          kind,
          title: item.title,
          subtitle: item.full_title !== item.title ? item.full_title : undefined,
          overview: item.summary || undefined,
          addedAt,
          releaseDate: item.originally_available_at
            ? new Date(item.originally_available_at)
            : undefined,
          genres: item.genres,
          raw: item,
        });
      }
    }

    return results;
  },

  async fetchPopularItems(
    config: SourceConnectionConfig,
    params: FetchPopularItemsParams,
  ): Promise<NewItem[]> {
    const apiKey = config.credentials.apiKey ?? "";
    const limit = params.limit ?? DEFAULT_FETCH_COUNT;
    const timeRangeDays = Math.max(
      1,
      Math.ceil((Date.now() - params.since.getTime()) / (24 * 60 * 60 * 1000)),
    );

    const requestedKinds = params.mediaKinds ?? (["movie", "tv_episode"] as MediaKind[]);
    const statIds = [
      ...new Set(
        requestedKinds
          .map((kind) => POPULAR_STAT_IDS_BY_KIND[kind])
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const results: NewItem[] = [];
    for (const statId of statIds) {
      const rows = await getHomeStats(config.baseUrl, apiKey, statId, timeRangeDays, limit);
      for (const row of rows) {
        const item = mapHomeStatRow(row);
        if (!item) continue;
        if (params.mediaKinds && !params.mediaKinds.includes(item.kind)) continue;
        results.push(item);
      }
    }

    return results;
  },
};
