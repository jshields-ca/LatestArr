export type MediaKind = "movie" | "tv_episode" | "tv_season" | "book" | "audiobook" | "game";

export interface NewItem {
  /** Adapter-local identifier for de-dupe; callers should namespace this
   * with the owning SourceConnection's id before persisting. */
  id: string;
  externalId: string;
  kind: MediaKind;
  title: string;
  subtitle?: string;
  overview?: string;
  addedAt: Date;
  releaseDate?: Date;
  posterUrl?: string;
  backdropUrl?: string;
  /** A short human-readable badge for a kind that MediaKind itself doesn't
   * distinguish — e.g. "Ebook" vs "Comic" for a BookLore-family "book", or
   * "Audiobook" vs "Podcast" for an Audiobookshelf "audiobook". Purely
   * cosmetic (rendered as a badge next to the item), so it's a free-form
   * string rather than a closed union — adding a new distinction inside an
   * existing MediaKind never has to touch this shared type again. */
  contentLabel?: string;
  genres?: string[];
  rating?: { source: string; value: number; scale: number };
  runtimeMinutes?: number;
  pageCount?: number;
  durationSeconds?: number;
  platform?: string;
  libraryName?: string;
  externalUrl?: string;
  /** Play count over the window a "most watched" query was made for —
   * only present on items returned by fetchPopularItems. */
  playCount?: number;
  /** Distinct viewer/user count over that same window — same caveat. */
  uniqueViewerCount?: number;
  raw?: unknown;
}

export interface SourceCapabilities {
  supportsMediaKinds: MediaKind[];
  supportsIncrementalSync: boolean;
}

export interface ConnectionTestResult {
  ok: boolean;
  message?: string;
  serverInfo?: { name: string; version?: string };
}

export interface SourceLibrary {
  id: string;
  name: string;
  kind: MediaKind;
}

export interface SourceConnectionConfig {
  baseUrl: string;
  /** The user-reachable address for this source, when it differs from
   * baseUrl (the address an adapter's own API calls target) — e.g.
   * Tautulli's baseUrl is its own API host, not a Plex-watchable URL, and a
   * RomM/Plex baseUrl may be a Tailscale/LAN address unreachable by an
   * email recipient on another network. An adapter that builds a per-item
   * NewItem.externalUrl should build it from `publicUrl ?? baseUrl`, so a
   * connection with no publicUrl set keeps building links from baseUrl —
   * today's behavior for a fully-public single-server setup. */
  publicUrl?: string;
  credentials: Record<string, string>;
  options?: Record<string, unknown>;
}

export interface FetchRecentItemsParams {
  since: Date;
  mediaKinds?: MediaKind[];
  libraryIds?: string[];
  limit?: number;
}

export interface FetchPopularItemsParams {
  /** Start of the window to rank plays over (e.g. "the last 7 days"). */
  since: Date;
  mediaKinds?: MediaKind[];
  limit?: number;
}

export interface FetchedImage {
  data: Uint8Array;
  contentType: string;
}

export interface SourceAdapter {
  readonly kind: string;
  readonly capabilities: SourceCapabilities;

  testConnection(config: SourceConnectionConfig): Promise<ConnectionTestResult>;

  listLibraries(config: SourceConnectionConfig): Promise<SourceLibrary[]>;

  fetchRecentItems(config: SourceConnectionConfig, params: FetchRecentItemsParams): Promise<NewItem[]>;

  /** Ranks by watch activity rather than recency ("most watched this
   * week"). Optional — a source only implements this if its API actually
   * exposes play/watch statistics; callers must check for its presence
   * before calling, the same way they do for fetchImageBytes. */
  fetchPopularItems?(
    config: SourceConnectionConfig,
    params: FetchPopularItemsParams,
  ): Promise<NewItem[]>;

  /**
   * Fetches an item's poster/cover image bytes using this source's stored
   * credentials, so the caller can embed them directly in the outgoing
   * email as a CID attachment instead of linking to a URL — the source is
   * frequently LAN-only, and a link that *would* work (e.g. Plex's
   * token-bearing thumb URL) still means shipping that source's own
   * secret out in a sent email's HTML.
   *
   * Superseded the previous `resolveImageUrl?(): Promise<string | null>`
   * shape (never implemented by any adapter): returning a URL doesn't
   * help a caller that has no way to attach the right credentials to a
   * later fetch of it (BookLore's OPDS covers sit behind HTTP Basic Auth,
   * which can't be embedded in a URL the way a Plex/Tautulli/Audiobookshelf
   * token can be added as a query param) — only the adapter that already
   * knows how to authenticate its own source's requests can reliably do
   * this. `item.posterUrl` may be an already-authenticated absolute URL
   * (Plex, Tautulli, Audiobookshelf) or a bare unauthenticated one
   * (RomM, BookLore); either way this method is the one place that knows
   * how to actually fetch it. Optional: implement only when a source
   * exposes cover art; callers must check for its presence, and it
   * resolves to null (never rejects) when the item has no image or the
   * fetch itself fails, so a caller can skip that one item's image
   * without failing the whole send.
   */
  fetchImageBytes?(config: SourceConnectionConfig, item: NewItem): Promise<FetchedImage | null>;
}
