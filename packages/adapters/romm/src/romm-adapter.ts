import type {
  ConnectionTestResult,
  FetchedImage,
  FetchRecentItemsParams,
  NewItem,
  SourceAdapter,
  SourceConnectionConfig,
  SourceLibrary,
} from "@latestarr/adapter-core";
import { buildRomWebUrl, fetchImage, getPlatforms, getRoms, type RommRom } from "./romm-client.js";

const DEFAULT_FETCH_COUNT = 100;

function mapRom(rom: RommRom, webUrl: string): NewItem {
  return {
    id: String(rom.id),
    externalId: String(rom.id),
    kind: "game",
    title: rom.name ?? rom.fs_name,
    subtitle: rom.platform_display_name,
    overview: rom.summary ?? undefined,
    addedAt: new Date(rom.created_at),
    posterUrl: rom.url_cover ?? undefined,
    externalUrl: buildRomWebUrl(webUrl, rom.id),
    raw: rom,
  };
}

export const rommAdapter: SourceAdapter = {
  kind: "romm",
  capabilities: {
    supportsMediaKinds: ["game"],
    supportsIncrementalSync: false,
  },

  async testConnection(config: SourceConnectionConfig): Promise<ConnectionTestResult> {
    try {
      await getPlatforms(config.baseUrl, config.credentials.token ?? "");
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Unknown error" };
    }
  },

  async listLibraries(config: SourceConnectionConfig): Promise<SourceLibrary[]> {
    const platforms = await getPlatforms(config.baseUrl, config.credentials.token ?? "");
    return platforms.map((platform) => ({ id: String(platform.id), name: platform.name, kind: "game" }));
  },

  async fetchRecentItems(
    config: SourceConnectionConfig,
    params: FetchRecentItemsParams,
  ): Promise<NewItem[]> {
    if (params.mediaKinds && !params.mediaKinds.includes("game")) {
      return [];
    }

    // Unlike Audiobookshelf, RomM's rom-listing endpoint accepts a
    // repeatable platform_ids query param directly, so a multi-library
    // filter is a single request rather than a per-library loop.
    const roms = await getRoms(
      config.baseUrl,
      config.credentials.token ?? "",
      params.limit ?? DEFAULT_FETCH_COUNT,
      params.libraryIds,
    );

    const webUrl = config.publicUrl ?? config.baseUrl;
    return roms.map((rom) => mapRom(rom, webUrl)).filter((item) => item.addedAt >= params.since);
  },

  // config is unused — url_cover is RomM's own public static asset URL, no
  // auth needed to fetch it (see romm-client.ts's fetchImage).
  async fetchImageBytes(_config: SourceConnectionConfig, item: NewItem): Promise<FetchedImage | null> {
    if (!item.posterUrl) return null;
    return fetchImage(item.posterUrl);
  },
};
