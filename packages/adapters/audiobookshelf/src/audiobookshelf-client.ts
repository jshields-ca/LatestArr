// Audiobookshelf exposes a documented REST API (see
// https://api.audiobookshelf.org/) authenticated with a bearer token
// (`Authorization: Bearer <token>`, or a `?token=` query param for GET
// requests — we use the header form here).

export interface AudiobookshelfLibrary {
  id: string;
  name: string;
  mediaType: string;
}

export interface AudiobookshelfMetadata {
  title: string;
  authorName?: string;
  description?: string;
  // Documented as a string (e.g. "2008"), not a number.
  publishedYear?: string;
}

export interface AudiobookshelfLibraryItem {
  id: string;
  mediaType: string;
  media: { metadata: AudiobookshelfMetadata; coverPath?: string };
  // Milliseconds since epoch — unlike Tautulli/Plex's seconds-based Unix
  // timestamps, this can be passed directly to `new Date(...)`.
  addedAt: number;
  updatedAt: number;
}

interface LibrariesResponse {
  libraries: AudiobookshelfLibrary[];
}

interface LibraryItemsResponse {
  results: AudiobookshelfLibraryItem[];
}

function buildUrl(baseUrl: string, path: string, params: Record<string, string> = {}): URL {
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const url = new URL(`${trimmedBase}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

async function callAudiobookshelf<T>(
  baseUrl: string,
  path: string,
  token: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = buildUrl(baseUrl, path, params);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Audiobookshelf request failed with HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function getLibraries(baseUrl: string, token: string): Promise<AudiobookshelfLibrary[]> {
  const body = await callAudiobookshelf<LibrariesResponse>(baseUrl, "/api/libraries", token);
  return body.libraries ?? [];
}

// Audiobookshelf's cover endpoint accepts the token as a `?token=` query
// param for GET requests (see the top-of-file comment) — unlike
// callAudiobookshelf's header-based auth used for the JSON API, this lets
// the resulting URL be fetched with no extra headers, the same way
// buildImageUrl works for the Plex adapter.
export function buildCoverUrl(baseUrl: string, token: string, itemId: string): string {
  return buildUrl(baseUrl, `/api/items/${itemId}/cover`, { token }).toString();
}

// resolvePosterPlaceholders (apps/server/src/pipeline/embed-images.ts)
// awaits every referenced item's image via Promise.all, so a source that's
// gone unreachable in a way that just hangs (rather than erroring — no
// RST, no timeout of its own) would otherwise never let that Promise.all
// settle, stalling the entire send indefinitely instead of failing this
// one item's poster softly.
const IMAGE_FETCH_TIMEOUT_MS = 10_000;

/**
 * Fetches a library item's cover image bytes for CID embedding. `imageUrl`
 * is expected to be one buildCoverUrl already produced (so the token is
 * already on it). Returns null instead of throwing on any failure
 * (including a timeout), so a caller embedding several items' images can
 * skip just this one.
 */
export async function fetchImage(
  imageUrl: string,
): Promise<{ data: Uint8Array; contentType: string } | null> {
  try {
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const data = new Uint8Array(await response.arrayBuffer());
    return { data, contentType };
  } catch {
    return null;
  }
}

export async function getLibraryItems(
  baseUrl: string,
  token: string,
  libraryId: string,
  count: number,
): Promise<AudiobookshelfLibraryItem[]> {
  const body = await callAudiobookshelf<LibraryItemsResponse>(
    baseUrl,
    `/api/libraries/${libraryId}/items`,
    token,
    { sort: "addedAt", desc: "1", limit: String(count) },
  );
  return body.results ?? [];
}
