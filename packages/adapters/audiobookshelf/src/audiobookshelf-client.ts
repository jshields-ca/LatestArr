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
