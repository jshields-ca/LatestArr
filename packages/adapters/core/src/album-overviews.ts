import type { NewItem } from "./source-adapter.js";

/** The most artists whose bio one fetch looks up. */
export const MAX_ARTIST_BIO_LOOKUPS = 25;

/**
 * Most albums in Plex have no description of their own. Where one is
 * missing, this gives the album its artist's bio instead, as Tautulli's own
 * newsletter does (#476).
 *
 * Each artist is looked up once, and only the first `maxArtists` artists
 * that need it are, so a large library doesn't mean hundreds of requests.
 * Items come newest first, so those are the albums a newsletter shows. A
 * failed or empty lookup leaves the album without a summary, as before.
 */
export async function fillAlbumOverviews(
  items: NewItem[],
  artistIdOf: (item: NewItem) => string | undefined,
  artistBio: (artistId: string) => Promise<string | undefined>,
  maxArtists = MAX_ARTIST_BIO_LOOKUPS,
): Promise<void> {
  const bios = new Map<string, Promise<string | undefined>>();
  for (const item of items) {
    if (item.kind !== "album" || item.overview) continue;
    const artistId = artistIdOf(item);
    if (!artistId) continue;
    let bio = bios.get(artistId);
    if (!bio) {
      if (bios.size >= maxArtists) continue;
      bio = artistBio(artistId).catch(() => undefined);
      bios.set(artistId, bio);
    }
    const text = (await bio)?.trim();
    if (text) item.overview = text;
  }
}
