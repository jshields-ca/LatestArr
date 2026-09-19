export interface PlexLibrary {
  key: string;
  title: string;
  type: string;
}

export interface PlexMetadataItem {
  ratingKey: string;
  title: string;
  type: string;
  addedAt: number;
  originallyAvailableAt?: string;
  summary?: string;
  thumb?: string;
  art?: string;
  grandparentTitle?: string;
  parentTitle?: string;
  parentIndex?: number;
  index?: number;
  year?: number;
}

interface PlexEnvelope<T> {
  MediaContainer: T;
}

function buildUrl(
  baseUrl: string,
  path: string,
  token: string,
  params: Record<string, string> = {},
): URL {
  // Concatenate rather than resolve as a relative URL, so any subpath in
  // baseUrl (e.g. behind a reverse proxy) is preserved instead of being
  // replaced by a leading-slash path.
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const url = new URL(`${trimmedBase}${path}`);
  url.searchParams.set("X-Plex-Token", token);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

// `thumb`/`art` on a PlexMetadataItem are paths relative to this same
// server (e.g. "/library/metadata/123/thumb/456"), not standalone URLs —
// this builds the same kind of token-bearing absolute URL any other Plex
// API call in this client already authenticates with, so the result can
// be fetched directly with no extra headers.
export function buildImageUrl(baseUrl: string, token: string, imagePath: string): string {
  return buildUrl(baseUrl, imagePath, token).toString();
}

/**
 * Fetches a Plex thumb/art image's raw bytes for CID embedding. `imageUrl`
 * is expected to be one buildImageUrl already produced (so the token is
 * already on it) — a plain fetch with no extra auth is enough. Returns
 * null instead of throwing on any failure, so a caller embedding several
 * items' images can skip just this one.
 */
export async function fetchImage(
  imageUrl: string,
): Promise<{ data: Uint8Array; contentType: string } | null> {
  try {
    const response = await fetch(imageUrl, { headers: { Accept: "image/*" } });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const data = new Uint8Array(await response.arrayBuffer());
    return { data, contentType };
  } catch {
    return null;
  }
}

async function callPlex<T>(
  baseUrl: string,
  path: string,
  token: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = buildUrl(baseUrl, path, token, params);
  // Plex Media Server defaults to XML; every endpoint honors this header to
  // return JSON instead, which is what the rest of this codebase's adapters
  // are built around.
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Plex request failed with HTTP ${response.status}`);
  }

  const body = (await response.json()) as PlexEnvelope<T>;
  return body.MediaContainer;
}

export async function getLibraries(baseUrl: string, token: string): Promise<PlexLibrary[]> {
  const container = await callPlex<{ Directory?: PlexLibrary[] }>(baseUrl, "/library/sections", token);
  return container.Directory ?? [];
}

export async function getRecentlyAdded(
  baseUrl: string,
  token: string,
  count: number,
  sectionKey?: string,
): Promise<PlexMetadataItem[]> {
  // A section key scopes to one library; omitting it hits Plex's own
  // cross-library "recently added" endpoint.
  const path = sectionKey ? `/library/sections/${sectionKey}/recentlyAdded` : "/library/recentlyAdded";
  const container = await callPlex<{ Metadata?: PlexMetadataItem[] }>(baseUrl, path, token, {
    "X-Plex-Container-Size": String(count),
  });
  return container.Metadata ?? [];
}
