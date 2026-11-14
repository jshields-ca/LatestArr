import { describe, expect, it } from "vitest";
import { includedKinds, isGroupIncluded, kindGroupsOf, toggledFilter } from "./source-kinds";

const plex = {
  mediaKinds: ["movie", "tv_episode", "tv_season", "album"],
  defaultMediaKinds: ["movie", "tv_episode", "tv_season"],
  mediaTypeFilter: null as string[] | null,
};

describe("source kinds", () => {
  it("groups a source's kinds the way designs do", () => {
    expect(kindGroupsOf(plex.mediaKinds)).toEqual([
      { label: "Movies", kinds: ["movie"] },
      { label: "TV", kinds: ["tv_episode", "tv_season"] },
      { label: "Music", kinds: ["album"] },
    ]);
    // Jellyfin has episodes but not seasons.
    expect(kindGroupsOf(["movie", "tv_episode"])[1]).toEqual({ label: "TV", kinds: ["tv_episode"] });
  });

  it("follows the defaults until something is chosen", () => {
    expect(includedKinds(plex)).toEqual(plex.defaultMediaKinds);
    const [, tv, music] = kindGroupsOf(plex.mediaKinds);
    expect(isGroupIncluded(plex, tv!)).toBe(true);
    expect(isGroupIncluded(plex, music!)).toBe(false);
  });

  it("turns a group on or off, back to null when that's the defaults", () => {
    const [movies, tv, music] = kindGroupsOf(plex.mediaKinds);
    const withMusic = toggledFilter(plex, music!);
    expect(withMusic).toEqual(["movie", "tv_episode", "tv_season", "album"]);
    expect(toggledFilter({ ...plex, mediaTypeFilter: withMusic }, music!)).toBeNull();
    expect(toggledFilter(plex, tv!)).toEqual(["movie"]);
    expect(toggledFilter({ ...plex, mediaTypeFilter: ["album"] }, movies!)).toEqual(["movie", "album"]);
  });
});
