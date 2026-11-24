import type { NewItem } from "./source-adapter.js";

/** The most artists whose bio one fetch looks up. */
export const MAX_ARTIST_BIO_LOOKUPS = 25;
/** How many of those lookups run at once. */
const LOOKUPS_AT_ONCE = 5;

/**
 * Most albums in Plex have no description of their own. Where one is
 * missing, this gives the album its artist's bio instead, as Tautulli's own
 * newsletter does (#476).
 *
 * Each artist is looked up once, and only the first `maxArtists` artists
 * that need it are, so a large library doesn't mean hundreds of requests.
 * Items come newest first, so those are the albums a newsletter shows.
 * Lookups run a few at a time, and stop at the first that fails: a server
 * that can't answer one is unlikely to answer the rest quickly, and each
 * could otherwise wait out its own timeout. An album whose artist wasn't
 * looked up, or has no bio, is left as it was.
 */
export async function fillAlbumOverviews(
  items: NewItem[],
  artistIdOf: (item: NewItem) => string | undefined,
  artistBio: (artistId: string) => Promise<string | undefined>,
  maxArtists = MAX_ARTIST_BIO_LOOKUPS,
): Promise<void> {
  const needsBio = (item: NewItem) => item.kind === "album" && !item.overview;
  const artists: string[] = [];
  for (const item of items) {
    const artistId = needsBio(item) ? artistIdOf(item) : undefined;
    if (artistId && !artists.includes(artistId) && artists.length < maxArtists) artists.push(artistId);
  }

  const bios = new Map<string, string>();
  let next = 0;
  let failed = false;
  const lookUp = async () => {
    while (!failed && next < artists.length) {
      const artistId = artists[next++]!;
      try {
        const bio = (await artistBio(artistId))?.trim();
        if (bio) bios.set(artistId, bio);
      } catch {
        failed = true;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(LOOKUPS_AT_ONCE, artists.length) }, lookUp));

  for (const item of items) {
    if (!needsBio(item)) continue;
    const artistId = artistIdOf(item);
    const bio = artistId ? bios.get(artistId) : undefined;
    if (bio) item.overview = bio;
  }
}
