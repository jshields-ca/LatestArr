import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";
import "./mjml-template.js";
import { buildSourceButtons } from "./source-buttons.js";

const video = ["movie", "tv_episode", "tv_season"];

describe("buildSourceButtons", () => {
  it("makes a button per source with a public URL, named for the service", () => {
    expect(
      buildSourceButtons([
        { kind: "tautulli", name: "Home Tautulli", publicUrl: "https://plex.example.com", kinds: video },
        { kind: "romm", name: "Games", publicUrl: "https://games.example.com", kinds: ["game"] },
        { kind: "booklore", name: "Books", publicUrl: null, kinds: ["book"] },
        { kind: "audiobookshelf", name: "Audiobooks", publicUrl: "https://abs.example.com", kinds: ["audiobook"] },
      ]),
    ).toMatchObject([
      { label: "Watch on Plex", url: "https://plex.example.com", kinds: video },
      { label: "Play on RomM", url: "https://games.example.com", kinds: ["game"] },
      { label: "Listen on Audiobookshelf", url: "https://abs.example.com", kinds: ["audiobook"] },
    ]);
  });

  it("merges sources sharing a public URL", () => {
    expect(
      buildSourceButtons([
        { kind: "plex", name: "Plex", publicUrl: "https://plex.example.com", kinds: ["movie"] },
        { kind: "tautulli", name: "Tautulli", publicUrl: "https://plex.example.com", kinds: video },
      ]),
    ).toMatchObject([{ label: "Watch on Plex", url: "https://plex.example.com", kinds: video }]);
  });

  it("uses each source's own name when two would share a label", () => {
    const labels = buildSourceButtons([
      { kind: "plex", name: "Home Plex", publicUrl: "https://a.example.com", kinds: video },
      { kind: "plex", name: "Cabin Plex", publicUrl: "https://b.example.com", kinds: video },
      { kind: "jellyfin", name: "Jelly", publicUrl: "https://c.example.com", kinds: video },
    ]).map((button) => button.label);
    expect(labels).toMatchObject(["Watch on Home Plex", "Watch on Cabin Plex", "Watch on Jellyfin"]);
  });

  it("falls back to the source's name for an unknown kind", () => {
    expect(buildSourceButtons([{ kind: "other", name: "My server", publicUrl: "https://x.example.com", kinds: [] }])[0]!.label).toBe(
      "Open My server",
    );
  });
});

describe("a source button under a section", () => {
  const [bookOrbit] = buildSourceButtons([
    { kind: "bookorbit", name: "Library", publicUrl: "https://books.example.com", kinds: ["book", "audiobook"] },
  ]);
  const under = (contentType: string) =>
    Handlebars.compile(`{{#sourceButtonsFor contentType="${contentType}"}}{{label}}{{/sourceButtonsFor}}`)({
      sourceButtons: [bookOrbit],
    });

  it("uses the verb that fits the section", () => {
    expect(bookOrbit).toMatchObject({
      label: "Read on BookOrbit",
      labelsByKind: { book: "Read on BookOrbit", audiobook: "Listen on BookOrbit" },
    });
    expect(under("book")).toBe("Read on BookOrbit");
    expect(under("audiobook")).toBe("Listen on BookOrbit");
  });

  it("keeps each source's own name when two would share a label", () => {
    const [first] = buildSourceButtons([
      { kind: "bookorbit", name: "Home", publicUrl: "https://a.example.com", kinds: ["book", "audiobook"] },
      { kind: "bookorbit", name: "Cabin", publicUrl: "https://b.example.com", kinds: ["book"] },
    ]);
    expect(first?.labelsByKind).toEqual({ book: "Read on Home", audiobook: "Listen on Home" });
  });
});
