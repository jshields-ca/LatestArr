import { describe, expect, it } from "vitest";
import { albumReleaseDate, mediaKindsFor, type SourceCapabilities } from "./source-adapter.js";

describe("albumReleaseDate", () => {
  it("keeps a real date", () => {
    expect(albumReleaseDate("2024-03-14")).toEqual(new Date("2024-03-14"));
  });

  // Plex gives 1 January when the tags only have a year (#354).
  it("leaves out 1 January, which is all a year-only tag gives", () => {
    expect(albumReleaseDate("2026-01-01")).toBeUndefined();
  });

  it("leaves out a missing or unreadable date", () => {
    expect(albumReleaseDate(undefined)).toBeUndefined();
    expect(albumReleaseDate("")).toBeUndefined();
    expect(albumReleaseDate("not a date")).toBeUndefined();
  });
});

describe("mediaKindsFor", () => {
  const plexLike: SourceCapabilities = {
    supportsMediaKinds: ["movie", "tv_episode", "tv_season", "album"],
    defaultMediaKinds: ["movie", "tv_episode", "tv_season"],
    supportsIncrementalSync: false,
  };

  it("gives the source's defaults when nothing was chosen", () => {
    expect(mediaKindsFor(plexLike)).toEqual(["movie", "tv_episode", "tv_season"]);
    expect(mediaKindsFor({ supportsMediaKinds: ["book"], supportsIncrementalSync: false })).toEqual(["book"]);
  });

  it("gives what was chosen, dropping kinds the source doesn't have", () => {
    expect(mediaKindsFor(plexLike, ["album", "book"])).toEqual(["album"]);
  });
});
