import type {
  ConnectionTestResult,
  FetchedImage,
  FetchPopularItemsParams,
  FetchRecentItemsParams,
  MediaKind,
  NewItem,
  SourceAdapter,
  SourceConnectionConfig,
  SourceLibrary,
} from "@latestarr/adapter-core";
import { buildPlexWebDeepLink, trimTrailingSlashes } from "@latestarr/adapter-core";
import {
  buildImageProxyUrl,
  fetchImage,
  getHomeStats,
  getLibraries,
  getRecentlyAdded,
  getServerId,
  type TautulliHomeStatRow,
  type TautulliRecentlyAddedItem,
} from "./tautulli-client.js";

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

// A `tv_episode` item's Tautulli-given `title` is just the episode's name
// (e.g. "Winter Is Coming") — rendered as the prominent title on its own,
// that reads as if the *episode* were the show, with no indication which
// series it belongs to. The series name (`grandparent_title`) belongs in
// the primary title instead, with the SxxExx/episode-name detail demoted
// to the subtitle. Only applied when Tautulli actually gives a
// grandparent_title (episode entries do; movies/other kinds don't), so a
// kind this doesn't apply to falls through to the caller's own default.
function buildEpisodeTitle(item: TautulliRecentlyAddedItem): string {
  return item.grandparent_title ?? item.title;
}

function buildEpisodeSubtitle(item: TautulliRecentlyAddedItem): string {
  const season = String(item.parent_media_index ?? 0).padStart(2, "0");
  const episode = String(item.media_index ?? 0).padStart(2, "0");
  return `S${season}E${episode} - ${item.title}`;
}

// Same problem as the bare episode title above, but for a tv_season item:
// its own `title` is just the season's name (e.g. "Season 1") with no
// indication which show it belongs to. Only applied when Tautulli actually
// gives a parent_title, so a season this doesn't apply to falls through to
// the caller's own default.
function buildSeasonTitle(item: TautulliRecentlyAddedItem): string {
  return item.parent_title ?? item.title;
}

function buildSeasonSubtitle(item: TautulliRecentlyAddedItem): string {
  return item.title;
}

function resolvePosterUrl(
  baseUrl: string,
  apiKey: string,
  thumb: string | undefined,
  art: string | undefined,
): string | undefined {
  const imagePath = thumb || art;
  return imagePath ? buildImageProxyUrl(baseUrl, apiKey, imagePath) : undefined;
}

// Unlike Plex/Audiobookshelf/RomM, Tautulli's own `baseUrl` is its API
// host, never a page a recipient should be sent to directly — so unset
// `publicUrl` here means no usable link at all, not a fallback to
// `baseUrl` the way every other adapter does. A link built from Tautulli's
// own API host would look clickable but lead to a broken page, which is
// worse than the no-link behavior this adapter had before externalUrl
// existed at all.
//
// Builds the per-item deep link once the underlying Plex server's
// machineIdentifier is known (via Tautulli's own get_server_id); falls
// back to a plain library-root link (still built from publicUrl, never
// baseUrl) when the identifier lookup failed.
function buildExternalUrl(
  publicUrl: string | undefined,
  machineIdentifier: string | undefined,
  ratingKey: string,
): string | undefined {
  if (!publicUrl) return undefined;
  if (machineIdentifier) return buildPlexWebDeepLink(publicUrl, machineIdentifier, ratingKey);
  return `${trimTrailingSlashes(publicUrl)}/web/index.html`;
}

function mapHomeStatRow(
  row: TautulliHomeStatRow,
  baseUrl: string,
  apiKey: string,
  publicUrl: string | undefined,
  machineIdentifier: string | undefined,
): NewItem | null {
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
    posterUrl: resolvePosterUrl(baseUrl, apiKey, row.thumb, row.art),
    externalUrl: buildExternalUrl(publicUrl, machineIdentifier, row.rating_key),
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

    // Only worth looking up when there's a publicUrl to build a link
    // from at all — buildExternalUrl returns undefined without one
    // regardless of machineIdentifier, so skipping this call then saves a
    // request most connections (no publicUrl set) would otherwise pay for
    // on every fetch. Best-effort when it does run: a failed lookup (e.g.
    // an older Tautulli version without get_server_id, or a transient
    // network hiccup) shouldn't fail the whole fetch, just mean every
    // item's externalUrl falls back to a plain library link.
    const machineIdentifier = config.publicUrl
      ? await getServerId(config.baseUrl, apiKey).catch(() => undefined)
      : undefined;

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

        const isEpisodeWithSeriesInfo = kind === "tv_episode" && Boolean(item.grandparent_title);
        const isSeasonWithShowInfo = kind === "tv_season" && Boolean(item.parent_title);

        results.push({
          id: item.rating_key,
          externalId: item.rating_key,
          kind,
          title: isEpisodeWithSeriesInfo
            ? buildEpisodeTitle(item)
            : isSeasonWithShowInfo
              ? buildSeasonTitle(item)
              : item.title,
          subtitle: isEpisodeWithSeriesInfo
            ? buildEpisodeSubtitle(item)
            : isSeasonWithShowInfo
              ? buildSeasonSubtitle(item)
              : item.full_title !== item.title
                ? item.full_title
                : undefined,
          overview: item.summary || undefined,
          addedAt,
          releaseDate: item.originally_available_at
            ? new Date(item.originally_available_at)
            : undefined,
          genres: item.genres,
          posterUrl: resolvePosterUrl(config.baseUrl, apiKey, item.thumb, item.art),
          externalUrl: buildExternalUrl(config.publicUrl, machineIdentifier, item.rating_key),
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

    const machineIdentifier = config.publicUrl
      ? await getServerId(config.baseUrl, apiKey).catch(() => undefined)
      : undefined;

    const results: NewItem[] = [];
    for (const statId of statIds) {
      const rows = await getHomeStats(config.baseUrl, apiKey, statId, timeRangeDays, limit);
      for (const row of rows) {
        const item = mapHomeStatRow(row, config.baseUrl, apiKey, config.publicUrl, machineIdentifier);
        if (!item) continue;
        if (params.mediaKinds && !params.mediaKinds.includes(item.kind)) continue;
        results.push(item);
      }
    }

    return results;
  },

  // posterUrl is already a full pms_image_proxy URL (built with
  // resolvePosterUrl above), which carries its own apikey — Tautulli
  // handles reaching the underlying Plex server itself, so this client
  // never needs a separate Plex token the way the Plex adapter does.
  async fetchImageBytes(_config: SourceConnectionConfig, item: NewItem): Promise<FetchedImage | null> {
    if (!item.posterUrl) return null;
    return fetchImage(item.posterUrl);
  },
};
