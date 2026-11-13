import { describe, expect, it } from "vitest";
import { buildWording, DEFAULT_WORDING } from "./wording.js";

const blank = { plural: "", singular: "" };

describe("buildWording (#390)", () => {
  it("uses today's words when nothing is set", () => {
    expect(DEFAULT_WORDING.dateOrder).toBe("monthFirst");
    expect(DEFAULT_WORDING.sectionNames.movie).toEqual({ heading: "Movies", browse: "Browse movies" });
    expect(DEFAULT_WORDING.sectionNames.tv).toEqual({ heading: "TV", browse: "Browse TV" });
    expect(DEFAULT_WORDING.countLabels.movie).toEqual(["movie", "movies"]);
    expect(buildWording({ movie: blank, book: { plural: "  ", singular: "" } })).toEqual(DEFAULT_WORDING);
  });

  it("uses a section's own name for its heading, its Browse button and its counts", () => {
    const wording = buildWording({ movie: { plural: "Films", singular: "Film" } });
    expect(wording.sectionNames.movie).toEqual({ heading: "Films", browse: "Browse films" });
    expect(wording.countLabels.movie).toEqual(["film", "films"]);
    // An item's badge, as typed.
    expect(wording.kindLabels.movie).toBe("Film");
    // Others keep theirs.
    expect(wording.sectionNames.book.heading).toBe("Books");
  });

  it("works out one from the name when only the name is given", () => {
    expect(buildWording({ movie: { plural: "Films", singular: "" } }).countLabels.movie).toEqual(["film", "films"]);
    // Nothing to take off: the name serves for one too.
    expect(buildWording({ book: { plural: "Manga", singular: "" } }).countLabels.book).toEqual(["manga", "manga"]);
    expect(buildWording({ book: { plural: "Classics", singular: "" } }).countLabels.book).toEqual(["classic", "classics"]);
  });

  it("keeps a name that starts with two capitals as it is mid-sentence", () => {
    const wording = buildWording({ tv: { plural: "BBC iPlayer", singular: "" }, game: { plural: "ROMs", singular: "ROM" } });
    expect(wording.sectionNames.tv.browse).toBe("Browse BBC iPlayer");
    expect(wording.countLabels.game).toEqual(["ROM", "ROMs"]);
  });

  it("never renames TV's counts, which are episodes and seasons", () => {
    const wording = buildWording({ tv: { plural: "Telly", singular: "Telly" } });
    expect(wording.sectionNames.tv.heading).toBe("Telly");
    expect(wording.countLabels.tv_episode).toEqual(["episode", "episodes"]);
    expect(wording.countLabels.tv_season).toEqual(["season", "seasons"]);
  });
});
