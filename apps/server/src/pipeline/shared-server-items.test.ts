import type { NewItem } from "@latestarr/adapter-core";
import { describe, expect, it } from "vitest";
import { mergeSharedServerItems, type FetchedFromSource } from "./shared-server-items.js";

function item(externalId: string, title: string, extra: Partial<NewItem> = {}): NewItem {
  return { id: externalId, externalId, kind: "movie", title, addedAt: new Date("2026-11-01T00:00:00Z"), ...extra };
}

// `null` is a source that can't say which server it reads.
function plex(items: NewItem[], serverId: string | null = "plex:abc"): FetchedFromSource {
  return { sourceName: "Home Plex", serverId: serverId ?? undefined, readsAnotherServer: false, items };
}

function tautulli(items: NewItem[], serverId: string | null = "plex:abc"): FetchedFromSource {
  return { sourceName: "Tautulli", serverId: serverId ?? undefined, readsAnotherServer: true, items };
}

describe("mergeSharedServerItems (#391)", () => {
  it("lists an item once when Plex and its Tautulli both return it", () => {
    const merged = mergeSharedServerItems([
      plex([item("1", "Dune"), item("2", "Heat")]),
      tautulli([item("1", "Dune"), item("3", "Alien")]),
    ]);
    expect(merged.items.map((i) => i.title)).toEqual(["Dune", "Heat", "Alien"]);
    expect(merged.leftOut).toEqual([{ from: "Tautulli", keptFrom: "Home Plex", count: 1 }]);
  });

  it("keeps Plex's copy whichever source comes first, in the earlier copy's place", () => {
    const fromPlex = item("1", "Dune", { externalUrl: "https://plex.example/dune" });
    const fromTautulli = item("1", "Dune", { externalUrl: "https://tautulli.example/dune" });
    const merged = mergeSharedServerItems([tautulli([fromTautulli, item("3", "Alien")]), plex([fromPlex])]);
    expect(merged.items).toHaveLength(2);
    expect(merged.items[0]).toBe(fromPlex);
    expect(merged.items[0]!.externalUrl).toBe("https://plex.example/dune");
    expect(merged.items[1]!.title).toBe("Alien");
    expect(merged.leftOut).toEqual([{ from: "Tautulli", keptFrom: "Home Plex", count: 1 }]);
  });

  it("fills in details only the other copy has, without replacing any the kept copy has", () => {
    const fromPlex = item("1", "Dune", { overview: "Plex's overview", posterUrl: "plex-poster" });
    const fromTautulli = item("1", "Dune", {
      overview: "Tautulli's overview",
      genres: ["Science fiction"],
      posterUrl: "tautulli-poster",
    });
    const [merged] = mergeSharedServerItems([plex([fromPlex]), tautulli([fromTautulli])]).items;
    expect(merged!.genres).toEqual(["Science fiction"]);
    expect(merged!.overview).toBe("Plex's overview");
    // An image is fetched through the source its item came from.
    expect(merged!.posterUrl).toBe("plex-poster");
  });

  it("doesn't merge two different servers whose rating keys happen to match", () => {
    const merged = mergeSharedServerItems([
      plex([item("1", "Dune")], "plex:home"),
      tautulli([item("1", "Heat")], "plex:cabin"),
    ]);
    expect(merged.items.map((i) => i.title)).toEqual(["Dune", "Heat"]);
    expect(merged.leftOut).toEqual([]);
  });

  it("doesn't merge when a source can't say which server it reads", () => {
    const merged = mergeSharedServerItems([plex([item("1", "Dune")]), tautulli([item("1", "Dune")], null)]);
    expect(merged.items).toHaveLength(2);
    const neither = mergeSharedServerItems([plex([item("1", "Dune")], null), tautulli([item("1", "Dune")], null)]);
    expect(neither.items).toHaveLength(2);
  });

  it("leaves a source's own repeats alone", () => {
    const merged = mergeSharedServerItems([plex([item("1", "Dune"), item("1", "Dune")])]);
    expect(merged.items).toHaveLength(2);
    expect(merged.leftOut).toEqual([]);
  });

  it("merges episodes one by one, and counts every copy left out", () => {
    const episodes = ["10", "11", "12"].map((id) => item(id, `Episode ${id}`, { kind: "tv_episode" }));
    const copies = episodes.map((episode) => ({ ...episode }));
    const merged = mergeSharedServerItems([plex(episodes), tautulli([...copies, item("20", "Heat")])]);
    expect(merged.items.map((i) => i.externalId)).toEqual(["10", "11", "12", "20"]);
    expect(merged.leftOut).toEqual([{ from: "Tautulli", keptFrom: "Home Plex", count: 3 }]);
  });
});
