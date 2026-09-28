import type {
  ConnectionTestResult,
  FetchedImage,
  FetchRecentItemsParams,
  MediaKind,
  NewItem,
  SourceAdapter,
  SourceConnectionConfig,
  SourceLibrary,
  SourceUser,
} from "@latestarr/adapter-core";
import { trimTrailingSlashes } from "@latestarr/adapter-core";
import {
  type BaseItem,
  buildImageUrl,
  fetchImage,
  getMediaFolders,
  getRecentItems,
  getServerInfo,
  getUsers,
  RECENT_ITEM_TYPES,
  type ServerFlavor,
} from "./jellyfin-client.js";

const DEFAULT_FETCH_COUNT = 100;
const TICKS_PER_SECOND = 10_000_000;

const ITEM_KIND: Record<string, MediaKind> = {
  Movie: "movie",
  Episode: "tv_episode",
  Book: "book",
  AudioBook: "audiobook",
};

const ITEM_TYPES_FOR_KIND: Partial<Record<MediaKind, string>> = Object.fromEntries(
  Object.entries(ITEM_KIND).map(([type, kind]) => [kind, type]),
);

// A library of mixed content has no CollectionType; "movie" is only a
// label for the library picker, never a filter on what's fetched from it.
function libraryKind(collectionType: string | undefined): MediaKind {
  switch (collectionType) {
    case "tvshows":
      return "tv_episode";
    case "books":
      return "book";
    default:
      return "movie";
  }
}

// An episode's own Name is just the episode title, so the series name
// leads and the SxxExx detail moves to the subtitle, as in the Plex adapter.
function episodeSubtitle(item: BaseItem): string | undefined {
  if (!item.SeriesName) return undefined;
  const season = String(item.ParentIndexNumber ?? 0).padStart(2, "0");
  const episode = String(item.IndexNumber ?? 0).padStart(2, "0");
  return `S${season}E${episode} - ${item.Name}`;
}

function author(item: BaseItem): string | undefined {
  return item.People?.find((person) => person.Type === "Author")?.Name ?? item.AlbumArtist;
}

// Episodes use their series' poster: an episode's own image is a video
// still, which looks out of place beside movie posters.
function posterUrl(baseUrl: string, item: BaseItem): string | undefined {
  if (item.Type === "Episode" && item.SeriesId && item.SeriesPrimaryImageTag) {
    return buildImageUrl(baseUrl, item.SeriesId, item.SeriesPrimaryImageTag);
  }
  if (item.ImageTags?.Primary) return buildImageUrl(baseUrl, item.Id, item.ImageTags.Primary);
  return undefined;
}

function itemLink(flavor: ServerFlavor, webUrl: string, item: BaseItem, serverId: string | undefined): string {
  const base = trimTrailingSlashes(webUrl);
  const id = encodeURIComponent(item.Id);
  const server = serverId ? `&serverId=${encodeURIComponent(serverId)}` : "";
  return flavor === "jellyfin"
    ? `${base}/web/#/details?id=${id}${server}`
    : `${base}/web/index.html#!/item?id=${id}${server}`;
}

function toNewItem(
  flavor: ServerFlavor,
  config: SourceConnectionConfig,
  item: BaseItem,
  kind: MediaKind,
  addedAt: Date,
  serverId: string | undefined,
): NewItem {
  const seconds = item.RunTimeTicks ? Math.round(item.RunTimeTicks / TICKS_PER_SECOND) : undefined;
  const isEpisode = kind === "tv_episode";
  return {
    id: item.Id,
    externalId: item.Id,
    kind,
    title: isEpisode ? (item.SeriesName ?? item.Name) : item.Name,
    subtitle: isEpisode ? episodeSubtitle(item) : kind === "book" || kind === "audiobook" ? author(item) : undefined,
    overview: item.Overview || undefined,
    addedAt,
    releaseDate: item.PremiereDate ? new Date(item.PremiereDate) : undefined,
    posterUrl: posterUrl(config.baseUrl, item),
    genres: item.Genres?.length ? item.Genres : undefined,
    rating: item.CommunityRating ? { source: flavor, value: item.CommunityRating, scale: 10 } : undefined,
    runtimeMinutes: seconds && (kind === "movie" || isEpisode) ? Math.round(seconds / 60) : undefined,
    durationSeconds: seconds && kind === "audiobook" ? seconds : undefined,
    externalUrl: itemLink(flavor, config.publicUrl ?? config.baseUrl, item, item.ServerId ?? serverId),
    raw: item,
  };
}

function createAdapter(flavor: ServerFlavor): SourceAdapter {
  const apiKeyOf = (config: SourceConnectionConfig) => config.credentials.apiKey ?? "";

  return {
    kind: flavor,
    capabilities: {
      supportsMediaKinds: ["movie", "tv_episode", "book", "audiobook"],
      supportsIncrementalSync: false,
    },

    async testConnection(config: SourceConnectionConfig): Promise<ConnectionTestResult> {
      try {
        const info = await getServerInfo(flavor, config.baseUrl, apiKeyOf(config));
        return { ok: true, serverInfo: { name: info.ServerName, version: info.Version } };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : "Unknown error" };
      }
    },

    async listLibraries(config: SourceConnectionConfig): Promise<SourceLibrary[]> {
      const folders = await getMediaFolders(flavor, config.baseUrl, apiKeyOf(config));
      return folders
        .filter((folder) => folder.CollectionType !== "music" && folder.CollectionType !== "playlists")
        .map((folder) => ({ id: folder.Id, name: folder.Name, kind: libraryKind(folder.CollectionType) }));
    },

    // Server accounts carry no email address, so every candidate needs one
    // added before it can become a recipient (see SourceUser).
    async listUsers(config: SourceConnectionConfig): Promise<SourceUser[]> {
      const users = await getUsers(flavor, config.baseUrl, apiKeyOf(config));
      return users.map((user) => ({ externalId: user.Id, username: user.Name }));
    },

    async fetchRecentItems(config: SourceConnectionConfig, params: FetchRecentItemsParams): Promise<NewItem[]> {
      const apiKey = apiKeyOf(config);
      const limit = params.limit ?? DEFAULT_FETCH_COUNT;
      const itemTypes = params.mediaKinds
        ? params.mediaKinds.map((kind) => ITEM_TYPES_FOR_KIND[kind]).filter((type): type is string => Boolean(type))
        : RECENT_ITEM_TYPES;
      if (itemTypes.length === 0) return [];

      // Item links need the server's id. Most responses carry it on each
      // item; this covers any that don't, and is best-effort.
      const serverId = await getServerInfo(flavor, config.baseUrl, apiKey)
        .then((info) => info.Id)
        .catch(() => undefined);

      const parentIds = params.libraryIds && params.libraryIds.length > 0 ? params.libraryIds : [undefined];
      const results: NewItem[] = [];
      const seen = new Set<string>();
      for (const parentId of parentIds) {
        const items = await getRecentItems(flavor, config.baseUrl, apiKey, { limit, parentId, itemTypes });
        for (const item of items) {
          const kind = ITEM_KIND[item.Type];
          if (!kind || !item.DateCreated || seen.has(item.Id)) continue;
          const addedAt = new Date(item.DateCreated);
          if (Number.isNaN(addedAt.getTime()) || addedAt < params.since) continue;
          seen.add(item.Id);
          results.push(toNewItem(flavor, config, item, kind, addedAt, serverId));
        }
      }
      return results;
    },

    async fetchImageBytes(config: SourceConnectionConfig, item: NewItem): Promise<FetchedImage | null> {
      if (!item.posterUrl) return null;
      return fetchImage(flavor, apiKeyOf(config), item.posterUrl);
    },
  };
}

export const jellyfinAdapter = createAdapter("jellyfin");
export const embyAdapter = createAdapter("emby");
