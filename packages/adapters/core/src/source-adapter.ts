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

export interface SourceAdapter {
  readonly kind: string;
  readonly capabilities: SourceCapabilities;

  testConnection(config: SourceConnectionConfig): Promise<ConnectionTestResult>;

  listLibraries(config: SourceConnectionConfig): Promise<SourceLibrary[]>;

  fetchRecentItems(config: SourceConnectionConfig, params: FetchRecentItemsParams): Promise<NewItem[]>;

  /** Ranks by watch activity rather than recency ("most watched this
   * week"). Optional — a source only implements this if its API actually
   * exposes play/watch statistics; callers must check for its presence
   * before calling, the same way they do for resolveImageUrl. */
  fetchPopularItems?(
    config: SourceConnectionConfig,
    params: FetchPopularItemsParams,
  ): Promise<NewItem[]>;

  resolveImageUrl?(
    config: SourceConnectionConfig,
    item: NewItem,
    kind: "poster" | "backdrop",
  ): Promise<string | null>;
}
