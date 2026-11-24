import { describe, expect, it, vi } from "vitest";
import { fillAlbumOverviews } from "./album-overviews.js";
import type { NewItem } from "./source-adapter.js";

const album = (id: string, artist: string, overview?: string): NewItem & { artist: string } => ({
  id,
  externalId: id,
  kind: "album",
  title: `Album ${id}`,
  addedAt: new Date(0),
  overview,
  artist,
});
const artistOf = (item: NewItem) => (item as NewItem & { artist?: string }).artist;

describe("fillAlbumOverviews", () => {
  it("gives an album with no description its artist's bio, and keeps an album's own", async () => {
    const items = [album("1", "a1"), album("2", "a2", "Its own words."), album("3", "a1")];
    const bio = vi.fn(async (id: string) => (id === "a1" ? "  An artist from Kyoto.  " : "Unused."));

    await fillAlbumOverviews(items, artistOf, bio);

    expect(items.map((item) => item.overview)).toEqual(["An artist from Kyoto.", "Its own words.", "An artist from Kyoto."]);
    // Once per artist, and not at all for an album with its own.
    expect(bio.mock.calls).toEqual([["a1"]]);
  });

  it("leaves the album as it was when the lookup fails or the artist has no bio", async () => {
    const items = [album("1", "a1"), album("2", "a2"), { ...album("3", "a3"), kind: "movie" as const }];
    const bio = vi.fn(async (id: string) => {
      if (id === "a1") throw new Error("HTTP 500");
      return "   ";
    });

    await fillAlbumOverviews(items, artistOf, bio);

    expect(items.map((item) => item.overview)).toEqual([undefined, undefined, undefined]);
    expect(bio.mock.calls.map(([id]) => id)).toEqual(["a1", "a2"]);
  });

  it("looks up only the first few artists, newest first", async () => {
    const items = ["a1", "a2", "a3", "a1"].map((artist, i) => album(String(i), artist));
    const bio = vi.fn(async (id: string) => `Bio of ${id}.`);

    await fillAlbumOverviews(items, artistOf, bio, 2);

    expect(items.map((item) => item.overview)).toEqual(["Bio of a1.", "Bio of a2.", undefined, "Bio of a1."]);
    expect(bio).toHaveBeenCalledTimes(2);
  });

  it("skips an album whose artist isn't known", async () => {
    const items = [album("1", "")];
    const bio = vi.fn(async () => "Bio.");
    await fillAlbumOverviews(items, () => undefined, bio);
    expect(bio).not.toHaveBeenCalled();
    expect(items[0]?.overview).toBeUndefined();
  });
});
