import { trimTrailingSlashes, readBytesCapped, SOURCE_REQUEST_TIMEOUT_MS } from "@latestarr/adapter-core";
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

// fast-xml-parser (with attributeNamePrefix "@_") turns each <link
// rel="..." href="..." type="..."/> into an object of its attributes.
export interface OpdsLink {
  "@_rel"?: string;
  "@_href"?: string;
  "@_type"?: string;
}

export interface OpdsEntry {
  id: string;
  title: string;
  updated?: string;
  author?: OpdsAuthor | OpdsAuthor[];
  summary?: string | { "#text"?: string };
  // BookOrbit puts the description here instead of <summary>, as
  // <content type="text">...</content> (or an empty <content type="text"/>).
  content?: string | { "#text"?: string };
  // fast-xml-parser coerces a purely-numeric text node (e.g. a bare
  // publication year like "2020") into a JS number, not a string — callers
  // must stringify before treating this as a date string.
  "dc:issued"?: string | number;
  // An entry typically carries several <link> elements (self, alternate,
  // acquisition, image, image/thumbnail, ...) — see getEntryImageHref and
  // getEntryFormatLabel below for what this is used for.
  link?: OpdsLink | OpdsLink[];
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

function textOf(node: OpdsEntry["summary"]): string | undefined {
  const text = typeof node === "string" ? node : node?.["#text"];
  return typeof text === "string" && text.trim() ? text.trim() : undefined;
}

/** An entry's description: <summary> (BookLore, Grimmory), or <content>
 * when there's no summary (BookOrbit). */
export function getEntrySummaryText(entry: OpdsEntry): string | undefined {
  return textOf(entry.summary) ?? textOf(entry.content);
}

function getEntryLinks(entry: OpdsEntry): OpdsLink[] {
  if (!entry.link) return [];
  return Array.isArray(entry.link) ? entry.link : [entry.link];
}

const OPDS_IMAGE_REL = "http://opds-spec.org/image";
const OPDS_IMAGE_THUMBNAIL_REL = "http://opds-spec.org/image/thumbnail";

/**
 * The href of an entry's cover image link, preferring the full-size image
 * rel over the thumbnail rel when both are present (per the OPDS spec,
 * https://specs.opds.io/opds-1.2#4-acquisition-feeds — a client should
 * fall back to the thumbnail only when no full image is offered).
 */
export function getEntryImageHref(entry: OpdsEntry): string | undefined {
  const links = getEntryLinks(entry);
  const full = links.find((link) => link["@_rel"] === OPDS_IMAGE_REL);
  if (full?.["@_href"]) return full["@_href"];
  const thumbnail = links.find((link) => link["@_rel"] === OPDS_IMAGE_THUMBNAIL_REL);
  return thumbnail?.["@_href"];
}

// Atom's rel="alternate" is the spec's own convention for "the human-
// readable page for this entry" (https://validator.w3.org/feed/docs/atom.html#link)
// — an OPDS feed serving as both the machine catalog and (via this link) a
// pointer to the same book's page in the source's own web reader. rel="self"
// is a much weaker fallback (strictly the entry's own Atom XML, not a page
// meant for a browser) but still resolves to *something* entry-specific
// rather than falling all the way back to a bare library link.
const OPDS_ALTERNATE_REL = "alternate";
const OPDS_SELF_REL = "self";

/** The href of an entry's rel="alternate" link, its human-readable page,
 * if the feed gives one. Resolve with resolveOpdsUrl before use. */
export function getEntryAlternateHref(entry: OpdsEntry): string | undefined {
  return getEntryLinks(entry).find((link) => link["@_rel"] === OPDS_ALTERNATE_REL)?.["@_href"];
}

/** The href of an entry's own permalink, if the feed gives one — see the
 * rel preference above. Resolve with resolveOpdsUrl before use, the same
 * as getEntryImageHref's result. */
export function getEntryPermalinkHref(entry: OpdsEntry): string | undefined {
  const alternate = getEntryAlternateHref(entry);
  if (alternate) return alternate;
  const self = getEntryLinks(entry).find((link) => link["@_rel"] === OPDS_SELF_REL);
  return self?.["@_href"];
}

// BookLore and Grimmory identify a book as urn:booklore:book:<id>, and
// BookOrbit as urn:bookorbit:book:<id>; all three show that book at
// /book/<id> in their web app. Their feeds carry no rel="alternate" link,
// so this id is the only way to link a recipient to the book itself.
const BOOK_URN = /^urn:(?:booklore|bookorbit):book:([A-Za-z0-9-]+)$/;

/** The app's own id for the book an entry describes, if its id says. */
export function getEntryBookId(entry: OpdsEntry): string | undefined {
  return BOOK_URN.exec(String(entry.id))?.[1];
}

// Comic archive MIME types BookLore/BookOrbit/Grimmory serve their
// acquisition link as when an entry is a comic rather than a prose ebook.
const COMIC_MIME_TYPES = new Set([
  "application/vnd.comicbook+zip",
  "application/vnd.comicbook-rar",
  "application/x-cbz",
  "application/x-cbr",
  "application/x-cb7",
]);

// Ebook MIME types these apps serve: EPUB, PDF, MOBI, AZW/AZW3 and FB2.
const EBOOK_MIME_TYPES = new Set([
  "application/epub+zip",
  "application/pdf",
  "application/x-mobipocket-ebook",
  "application/vnd.amazon.ebook",
  "application/x-fictionbook+xml",
]);

const isAudioType = (type: string) => type.startsWith("audio/");

function getAcquisitionLinks(entry: OpdsEntry): OpdsLink[] {
  return getEntryLinks(entry).filter((link) => (link["@_rel"] ?? "").startsWith("http://opds-spec.org/acquisition"));
}

/**
 * Whether an entry is an audiobook: every file it offers is audio. BookOrbit
 * serves audiobook files with audio/* types (audio/mp4 for .m4b, audio/mpeg
 * for .mp3, ...). A book with both an ebook and its audio stays a book.
 */
export function isAudiobookEntry(entry: OpdsEntry): boolean {
  const types = getAcquisitionLinks(entry).map((link) => link["@_type"] ?? "");
  return types.length > 0 && types.every(isAudioType);
}

/**
 * A short "Audiobook"/"Ebook"/"Comic"/"Book" badge (plus " + audio" when
 * the item also has audio files) derived from the acquisition
 * link's declared MIME type — OPDS itself has no dedicated field for this,
 * so the file format on the download link is the only signal available.
 * Falls back to the generic "Book" label when there's no acquisition link
 * or its type isn't one we recognize, rather than guessing.
 */
export function getEntryFormatLabel(entry: OpdsEntry): string {
  if (isAudiobookEntry(entry)) return "Audiobook";
  const types = getAcquisitionLinks(entry).map((link) => link["@_type"] ?? "");
  const type = types.find((candidate) => !isAudioType(candidate));
  const label =
    type && COMIC_MIME_TYPES.has(type) ? "Comic" : type && EBOOK_MIME_TYPES.has(type) ? "Ebook" : "Book";
  // One item with both a readable file and its audio, e.g. an EPUB and an M4B.
  return types.some(isAudioType) ? `${label} + audio` : label;
}

/** Resolves a (possibly relative) OPDS link href against the feed's own
 * base URL, the way a browser would resolve a relative <img src>. */
export function resolveOpdsUrl(baseUrl: string, href: string): string {
  return new URL(href, baseUrl).toString();
}

function buildUrl(baseUrl: string, path: string, params: Record<string, string> = {}): URL {
  const trimmedBase = trimTrailingSlashes(baseUrl);
  const url = new URL(`${trimmedBase}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

function sameOrigin(url: string, baseUrl: string): boolean {
  try {
    return new URL(url).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
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
    signal: AbortSignal.timeout(SOURCE_REQUEST_TIMEOUT_MS),
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

// resolvePosterPlaceholders (apps/server/src/pipeline/embed-images.ts)
// awaits every referenced item's image via Promise.all, so a source that's
// gone unreachable in a way that just hangs (rather than erroring — no
// RST, no timeout of its own) would otherwise never let that Promise.all
// settle, stalling the entire send indefinitely instead of failing this
// one item's poster softly.
const IMAGE_FETCH_TIMEOUT_MS = 10_000;

/**
 * Fetches an OPDS cover image's raw bytes, authenticated with the same
 * Basic Auth credentials as every other OPDS request this client makes —
 * unlike Plex/Tautulli/Audiobookshelf, Basic Auth can't be embedded as a
 * query param on the URL itself, so this always needs the credentials
 * passed explicitly rather than being just a plain fetch of `imageUrl`.
 * Returns null instead of throwing on any failure (including a timeout),
 * so a caller embedding several items' images can skip just this one.
 */
export async function fetchOpdsImage(
  imageUrl: string,
  baseUrl: string,
  username: string,
  password: string,
): Promise<{ data: Uint8Array; contentType: string } | null> {
  try {
    const response = await fetch(imageUrl, {
      // A cover the feed links on another host gets no credentials.
      headers: sameOrigin(imageUrl, baseUrl) ? { Authorization: buildAuthHeader(username, password) } : {},
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const data = await readBytesCapped(response);
    return data ? { data, contentType } : null;
  } catch {
    return null;
  }
}

export async function getRecentEntries(
  baseUrl: string,
  username: string,
  password: string,
  count: number,
): Promise<OpdsEntry[]> {
  return fetchOpdsFeed(baseUrl, "/api/v1/opds/recent", username, password, { size: String(count) });
}
