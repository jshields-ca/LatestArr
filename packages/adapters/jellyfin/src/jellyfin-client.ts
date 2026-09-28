import { trimTrailingSlashes } from "@latestarr/adapter-core";

// Jellyfin began as a fork of Emby, and the two still share most of their
// REST API: the same /Items, /Library/MediaFolders, /Users, and image
// endpoints with the same JSON shapes. What differs is how an API key is
// sent and how the web app links to an item, so this client takes the
// flavour and the adapters stay thin.
export type ServerFlavor = "jellyfin" | "emby";

export interface MediaFolder {
  Id: string;
  Name: string;
  /** "movies", "tvshows", "books", "music", ... Absent for a mixed library. */
  CollectionType?: string;
}

export interface BaseItem {
  Id: string;
  Name: string;
  /** "Movie", "Episode", "Book", "AudioBook", "Series", "Audio", ... */
  Type: string;
  ServerId?: string;
  Overview?: string;
  /** When the item was added to the library. Needs Fields=DateCreated. */
  DateCreated?: string;
  PremiereDate?: string;
  ProductionYear?: number;
  CommunityRating?: number;
  Genres?: string[];
  /** 100-nanosecond ticks: 10,000,000 per second. */
  RunTimeTicks?: number;
  SeriesName?: string;
  SeriesId?: string;
  /** An episode's season number. */
  ParentIndexNumber?: number;
  /** An episode's number within its season. */
  IndexNumber?: number;
  ImageTags?: { Primary?: string };
  SeriesPrimaryImageTag?: string;
  /** Book or audiobook author(s). */
  AlbumArtist?: string;
  People?: { Name: string; Type?: string }[];
}

export interface ServerInfo {
  Id: string;
  ServerName: string;
  Version?: string;
}

export interface ServerUser {
  Id: string;
  Name: string;
  /** Emby only: the Emby Connect account linked to this user, which is
   * often (not always) an email address. */
  ConnectUserName?: string;
  Policy?: { IsDisabled?: boolean };
}

const REQUEST_TIMEOUT_MS = 15_000;
// resolvePosterPlaceholders (apps/server/src/pipeline/embed-images.ts)
// waits on every poster at once, so a server that hangs instead of
// erroring must not stall the whole send.
const IMAGE_FETCH_TIMEOUT_MS = 10_000;

// Jellyfin reads the key from its own Authorization scheme; its older
// X-Emby-Token header is deprecated and can be switched off. Emby reads
// X-Emby-Token.
export function authHeaders(flavor: ServerFlavor, apiKey: string): Record<string, string> {
  return flavor === "jellyfin"
    ? { Authorization: `MediaBrowser Token="${apiKey}"` }
    : { "X-Emby-Token": apiKey };
}

// Concatenated rather than resolved, so a subpath in baseUrl (behind a
// reverse proxy, or Emby's own /emby prefix) is kept.
function buildUrl(baseUrl: string, path: string, params: Record<string, string> = {}): URL {
  const url = new URL(`${trimTrailingSlashes(baseUrl)}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

async function call<T>(
  flavor: ServerFlavor,
  baseUrl: string,
  apiKey: string,
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const label = flavor === "jellyfin" ? "Jellyfin" : "Emby";
  const response = await fetch(buildUrl(baseUrl, path, params), {
    headers: { Accept: "application/json", ...authHeaders(flavor, apiKey) },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error(`${label} rejected the API key (HTTP ${response.status})`);
  }
  if (!response.ok) {
    throw new Error(`${label} request failed with HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export function getServerInfo(flavor: ServerFlavor, baseUrl: string, apiKey: string): Promise<ServerInfo> {
  return call<ServerInfo>(flavor, baseUrl, apiKey, "/System/Info");
}

export async function getMediaFolders(flavor: ServerFlavor, baseUrl: string, apiKey: string): Promise<MediaFolder[]> {
  const body = await call<{ Items?: MediaFolder[] }>(flavor, baseUrl, apiKey, "/Library/MediaFolders");
  return body.Items ?? [];
}

export function getUsers(flavor: ServerFlavor, baseUrl: string, apiKey: string): Promise<ServerUser[]> {
  return call<ServerUser[]>(flavor, baseUrl, apiKey, "/Users");
}

export const RECENT_ITEM_TYPES = ["Movie", "Episode", "Book", "AudioBook"];

const RECENT_ITEM_FIELDS = ["DateCreated", "Overview", "Genres", "PremiereDate", "People"];

// Newest first across the whole server, or one library when parentId is
// given. Neither server filters by date added, so callers page in `limit`
// items and stop at their cutoff.
export async function getRecentItems(
  flavor: ServerFlavor,
  baseUrl: string,
  apiKey: string,
  options: { limit: number; parentId?: string; itemTypes?: string[] },
): Promise<BaseItem[]> {
  const body = await call<{ Items?: BaseItem[] }>(flavor, baseUrl, apiKey, "/Items", {
    Recursive: "true",
    IncludeItemTypes: (options.itemTypes ?? RECENT_ITEM_TYPES).join(","),
    SortBy: "DateCreated",
    SortOrder: "Descending",
    Limit: String(options.limit),
    Fields: RECENT_ITEM_FIELDS.join(","),
    ...(options.parentId && { ParentId: options.parentId }),
  });
  return body.Items ?? [];
}

// An item's primary image, sized for an email card. The key is not part of
// the URL: fetchImage sends it as a header, so the URL is safe to log.
export function buildImageUrl(baseUrl: string, itemId: string, tag?: string): string {
  return buildUrl(baseUrl, `/Items/${encodeURIComponent(itemId)}/Images/Primary`, {
    maxHeight: "450",
    quality: "90",
    ...(tag && { tag }),
  }).toString();
}

// Resolves to null (never rejects), so one missing poster doesn't fail a send.
export async function fetchImage(
  flavor: ServerFlavor,
  apiKey: string,
  imageUrl: string,
): Promise<{ data: Uint8Array; contentType: string } | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: { Accept: "image/*", ...authHeaders(flavor, apiKey) },
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    return { data: new Uint8Array(await response.arrayBuffer()), contentType };
  } catch {
    return null;
  }
}
