import { describe, expect, it } from "vitest";
import { type LinkForChoice, libraryChoices } from "./library-choice.js";

const link = (sourceId: string, libraryFilter: string[] | null, canShareServer = true): LinkForChoice => ({
  sourceId,
  sourceName: sourceId,
  libraryFilter,
  canShareServer,
});

describe("libraryChoices", () => {
  it("reads every library with nothing chosen, and only the chosen ones otherwise", () => {
    const choices = libraryChoices([link("plex", null), link("jellyfin", ["a", "b", "a"], false)], new Map());
    expect(choices.get("plex")).toEqual({ read: true, libraries: undefined });
    expect(choices.get("jellyfin")).toEqual({ read: true, libraries: ["a", "b"] });
  });

  it("treats an empty choice, which linking once allowed, as every library", () => {
    expect(libraryChoices([link("plex", [])], new Map()).get("plex")).toEqual({ read: true, libraries: undefined });
  });

  it("holds a choice for every source reading the same server", () => {
    const serverIds = new Map([
      ["plex", "plex:one"],
      ["tautulli", "plex:one"],
      ["other", "plex:two"],
    ]);
    const choices = libraryChoices([link("plex", ["1", "2"]), link("tautulli", null), link("other", null)], serverIds);
    expect(choices.get("plex")).toEqual({ read: true, libraries: ["1", "2"] });
    expect(choices.get("tautulli")).toEqual({ read: true, libraries: ["1", "2"] });
    expect(choices.get("other")).toEqual({ read: true, libraries: undefined });
  });

  it("reads only what every source on the server allows, and nothing when they share none", () => {
    const serverIds = new Map([
      ["plex", "plex:one"],
      ["tautulli", "plex:one"],
    ]);
    const some = libraryChoices([link("plex", ["1", "2"]), link("tautulli", ["2", "3"])], serverIds);
    expect(some.get("plex")).toEqual({ read: true, libraries: ["2"] });
    expect(some.get("tautulli")).toEqual({ read: true, libraries: ["2"] });

    const none = libraryChoices([link("plex", ["1"]), link("tautulli", ["2"])], serverIds);
    expect(none.get("plex")).toMatchObject({ read: false });
    expect(none.get("tautulli")).toMatchObject({ read: false });
  });

  it("skips a source that might read a server with libraries left out but couldn't say", () => {
    // Tautulli couldn't say which server it reads; Plex has libraries chosen.
    const unknownWatcher = libraryChoices([link("plex", ["1"]), link("tautulli", null)], new Map([["plex", "plex:one"]]));
    expect(unknownWatcher.get("plex")).toEqual({ read: true, libraries: ["1"] });
    expect(unknownWatcher.get("tautulli")).toMatchObject({
      read: false,
      reason: expect.stringContaining(`"tautulli" is left out`),
    });

    // Plex, with the choice, couldn't say; Tautulli could.
    const unknownServer = libraryChoices([link("plex", ["1"]), link("tautulli", null)], new Map([["tautulli", "plex:one"]]));
    expect(unknownServer.get("plex")).toEqual({ read: true, libraries: ["1"] });
    expect(unknownServer.get("tautulli")).toMatchObject({ read: false });

    // A choice within the other's can't let a left-out library in; one
    // wider than it could.
    const within = libraryChoices([link("plex", ["1", "2"]), link("tautulli", ["1"])], new Map());
    expect(within.get("tautulli")).toEqual({ read: true, libraries: ["1"] });
    expect(within.get("plex")).toMatchObject({ read: false });
  });

  it("never holds back a source that can't share a server", () => {
    const choices = libraryChoices([link("plex", ["1"]), link("jellyfin", null, false)], new Map());
    expect(choices.get("jellyfin")).toEqual({ read: true, libraries: undefined });
  });
});
