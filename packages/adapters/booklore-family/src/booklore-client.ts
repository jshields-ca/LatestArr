import { XMLParser } from "fast-xml-parser";

// BookLore (and its compatible forks BookOrbit and Grimmory) expose their
// library through OPDS — a standardized Atom-based catalog format — rather
// than a documented internal REST API (BookLore's own docs describe their
// internal API as "undocumented, unversioned, and may change... without
// notice"). OPDS is authenticated with HTTP Basic Auth using dedicated OPDS
// credentials, separate from the app's own login.
// See: https://specs.opds.io/opds-1.2

export interface OpdsAuthor {
  name?: string;
}

export interface OpdsEntry {
  id: string;
  title: string;
  updated?: string;
  author?: OpdsAuthor | OpdsAuthor[];
  summary?: string | { "#text"?: string };
  // fast-xml-parser coerces a purely-numeric text node (e.g. a bare
  // publication year like "2020") into a JS number, not a string — callers
  // must stringify before treating this as a date string.
  "dc:issued"?: string | number;
}

interface RawOpdsFeed {
  feed?: {
    entry?: OpdsEntry | OpdsEntry[];
  };
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

export function getEntryAuthorName(entry: OpdsEntry): string | undefined {
  const author = Array.isArray(entry.author) ? entry.author[0] : entry.author;
  return author?.name;
}

export function getEntrySummaryText(entry: OpdsEntry): string | undefined {
  if (typeof entry.summary === "string") return entry.summary;
  return entry.summary?.["#text"];
}

function buildUrl(baseUrl: string, path: string, params: Record<string, string> = {}): URL {
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const url = new URL(`${trimmedBase}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

function buildAuthHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

async function fetchOpdsFeed(
  baseUrl: string,
  path: string,
  username: string,
  password: string,
  params?: Record<string, string>,
): Promise<OpdsEntry[]> {
  const url = buildUrl(baseUrl, path, params);
  const response = await fetch(url, {
    headers: { Authorization: buildAuthHeader(username, password) },
  });
  if (!response.ok) {
    throw new Error(`BookLore OPDS request failed with HTTP ${response.status}`);
  }

  const xml = await response.text();
  const feed = parser.parse(xml) as RawOpdsFeed;
  const entry = feed.feed?.entry;
  if (!entry) return [];
  return Array.isArray(entry) ? entry : [entry];
}

export async function getLibraries(
  baseUrl: string,
  username: string,
  password: string,
): Promise<OpdsEntry[]> {
  return fetchOpdsFeed(baseUrl, "/api/v1/opds/libraries", username, password);
}

export async function getRecentEntries(
  baseUrl: string,
  username: string,
  password: string,
  count: number,
): Promise<OpdsEntry[]> {
  return fetchOpdsFeed(baseUrl, "/api/v1/opds/recent", username, password, { size: String(count) });
}
