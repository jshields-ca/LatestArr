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

export interface SourceAdapter {
  readonly kind: string;
  readonly capabilities: SourceCapabilities;

  testConnection(config: SourceConnectionConfig): Promise<ConnectionTestResult>;

  listLibraries(config: SourceConnectionConfig): Promise<SourceLibrary[]>;

  fetchRecentItems(config: SourceConnectionConfig, params: FetchRecentItemsParams): Promise<NewItem[]>;

  resolveImageUrl?(
    config: SourceConnectionConfig,
    item: NewItem,
    kind: "poster" | "backdrop",
  ): Promise<string | null>;
}
