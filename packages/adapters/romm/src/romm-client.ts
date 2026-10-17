// RomM exposes a documented REST API under an /api prefix (see
// https://docs.romm.app/). Server-to-server integrations authenticate with
// a long-lived "Client API Token" (issued from Administration -> Client API
// Tokens, formatted `rmm_<64 hex chars>`) sent as a bearer token — the same
// header shape as the OAuth2 access tokens the browser flow uses, so one
// client works for both.

import { IMAGE_REQUEST_TIMEOUT_MS, readBytesCapped, SOURCE_REQUEST_TIMEOUT_MS, trimTrailingSlashes } from "@latestarr/adapter-core";

export interface RommPlatform {
  id: number;
  name: string;
  slug: string;
}

export interface RommRom {
  id: number;
  name: string | null;
  fs_name: string;
  platform_display_name: string;
  summary?: string | null;
  url_cover?: string | null;
  created_at: string;
}

interface RommPage<T> {
  items: T[];
}

function buildUrl(baseUrl: string, path: string, params: Record<string, string | string[]> = {}): URL {
  const trimmedBase = trimTrailingSlashes(baseUrl);
  const url = new URL(`${trimmedBase}${path}`);
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      url.searchParams.append(key, item);
    }
  }
  return url;
}

async function callRomm<T>(
  baseUrl: string,
  path: string,
  token: string,
  params?: Record<string, string | string[]>,
): Promise<T> {
  const url = buildUrl(baseUrl, path, params);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(SOURCE_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`RomM request failed with HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

/**
 * Fetches a rom's cover image bytes for CID embedding. `rom.url_cover` is
 * RomM's own already-public, unauthenticated static asset URL (the same
 * one this adapter has always handed straight to an `<img src>` in a sent
 * email) — no bearer token needed, unlike every request this client makes
 * against RomM's actual `/api/...` surface. Returns null instead of
 * throwing on any failure (including a timeout), so a caller embedding
 * several items' images can skip just this one.
 */
export async function fetchImage(
  imageUrl: string,
): Promise<{ data: Uint8Array; contentType: string } | null> {
  try {
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(IMAGE_REQUEST_TIMEOUT_MS) });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const data = await readBytesCapped(response);
    return data ? { data, contentType } : null;
  } catch {
    return null;
  }
}

// RomM's web frontend resolves a rom's detail page at this route — no auth
// needed in the URL itself, unlike the /api/... calls this client makes,
// since opening it in a browser goes through the frontend's own session.
export function buildRomWebUrl(webUrl: string, romId: number): string {
  return `${trimTrailingSlashes(webUrl)}/rom/${romId}`;
}

export async function getPlatforms(baseUrl: string, token: string): Promise<RommPlatform[]> {
  return callRomm<RommPlatform[]>(baseUrl, "/api/platforms", token);
}

export async function getRoms(
  baseUrl: string,
  token: string,
  count: number,
  platformIds?: string[],
  offset = 0,
): Promise<RommRom[]> {
  const params: Record<string, string | string[]> = {
    order_by: "created_at",
    order_dir: "desc",
    limit: String(count),
    offset: String(offset),
  };
  if (platformIds && platformIds.length > 0) {
    params.platform_ids = platformIds;
  }
  const page = await callRomm<RommPage<RommRom>>(baseUrl, "/api/roms", token, params);
  return page.items ?? [];
}

export interface RommUser {
  id: number;
  username: string;
  email?: string | null;
  enabled?: boolean;
}

// Needs a client API token with the users.read scope.
export async function getUsers(baseUrl: string, token: string): Promise<RommUser[]> {
  return callRomm<RommUser[]>(baseUrl, "/api/users", token);
}
