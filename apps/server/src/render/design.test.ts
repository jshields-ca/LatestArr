import type { NewItem } from "@latestarr/adapter-core";
import { describe, expect, it } from "vitest";
import {
  buildDesignMjml,
  DEFAULT_DESIGN_SETTINGS,
  designContentVariables,
  type DesignSettings,
  designSettingsSchema,
  parseDesignSettings,
} from "./design.js";
import { renderDesignSample } from "./design-sample.js";
import { type MjmlRenderContext, renderMjmlTemplate } from "./mjml-template.js";

const generatedAt = new Date("2026-01-20T12:00:00Z");

function item(overrides: Partial<NewItem>): NewItem {
  return {
    id: overrides.title ?? "1",
    externalId: overrides.title ?? "1",
    kind: "movie",
    title: "Some Movie",
    addedAt: new Date("2026-01-15T12:00:00Z"),
    ...overrides,
  };
}

const movie = item({ title: "A Movie", overview: "Movie overview.", posterUrl: "https://img.example/m.jpg" });
const book = item({ kind: "book", title: "A Book", contentLabel: "Ebook", pageCount: 200 });

function design(overrides: Record<string, unknown>): DesignSettings {
  return designSettingsSchema.parse(overrides);
}

function render(settings: DesignSettings, context: Partial<MjmlRenderContext> = {}) {
  return renderMjmlTemplate(buildDesignMjml(settings), {
    newsletterName: "Weekly Digest",
    items: [movie, book],
    generatedAt,
    lookbackDays: 7,
    ...context,
  });
}

describe("design settings", () => {
  it("fills every missing option with its default", () => {
    expect(DEFAULT_DESIGN_SETTINGS).toMatchObject({
      font: "ubuntu",
      layout: "cards",
      colors: { accent: "#c31d4c", background: "#ffffff" },
      show: { poster: true, overview: true },
      sections: { groupByType: true, groupEpisodes: true, empty: "message", mostWatched: { enabled: false, count: 5 } },
      customCss: "",
    });
    expect(design({ layout: "grid", show: { poster: false } })).toMatchObject({
      layout: "grid",
      show: { poster: false, overview: true },
      sections: { limit: null },
    });
  });

  it("rejects invalid values, and falls back to the defaults when reading a bad stored value", () => {
    expect(designSettingsSchema.safeParse({ colors: { accent: "red" } }).success).toBe(false);
    expect(designSettingsSchema.safeParse({ layout: "carousel" }).success).toBe(false);
    expect(parseDesignSettings({ colors: { accent: "javascript:alert(1)" } })).toEqual(DEFAULT_DESIGN_SETTINGS);
    expect(parseDesignSettings(null)).toEqual(DEFAULT_DESIGN_SETTINGS);
  });
});

describe("buildDesignMjml", () => {
  it("renders the compact layout as one line per item, without posters", async () => {
    const html = await render(design({ layout: "compact" }));
    expect(html).toContain("A Movie");
    expect(html).toContain("200 pages");
    expect(html).not.toContain("https://img.example/m.jpg");
    expect(html).not.toContain("Movie overview.");
  });

  it("declares light and dark support, with dark colours derived from a custom palette", async () => {
    const html = await render(design({ colors: { accent: "#1D4ED8", background: "#FAFAFA", text: "#111111", muted: "#555555" } }));
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
    expect(html).toContain("background-color:#fafafa");
    // Matched by value, lower-cased the same way the inline styles are.
    expect(html).toContain('[style*="color:#111111"] { color:');
    expect(html).toContain('[data-ogsc] [style*="color:#1d4ed8"]');
    expect(html).toContain('[data-ogsb] [style*="background-color:#fafafa"]');
  });

  it("leaves an already dark design's colours alone in dark mode", async () => {
    const html = await render(design({ colors: { background: "#101820", text: "#f0f0f0" } }));
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
    expect(html).not.toContain("prefers-color-scheme");
  });

  it("gives badges an outline, so they survive a client dropping their background", async () => {
    const html = await render(design({}));
    expect(html).toMatch(/border:1px solid #[0-9a-f]{6};border-radius:999px;[^"]*">Movie</);
  });

  it("renders the grid layout as posters side by side", async () => {
    const html = await render(design({ layout: "grid" }));
    expect(html).toContain("display:inline-block;width:50%");
    expect(html).toContain("https://img.example/m.jpg");
  });

  it("leaves out each item detail that's switched off", async () => {
    const html = await render(design({ show: { poster: false, overview: false, badge: false, dates: false } }));
    expect(html).not.toContain("https://img.example/m.jpg");
    expect(html).not.toContain("Movie overview.");
    expect(html).not.toContain("Ebook");
    expect(html).not.toContain("Added January 15, 2026");
    expect(html).toContain("A Book");
  });

  it("applies custom colours, derives the lighter shades, and sets the page background", async () => {
    const html = await render(design({ colors: { accent: "#0055aa", background: "#101820", text: "#eeeeee", muted: "#aabbcc" } }));
    expect(html).toContain("#0055aa");
    expect(html).toContain("#eeeeee");
    expect(html.toLowerCase()).toContain("background-color:#101820");
    expect(html).not.toContain("#c31d4c");
  });

  it("can hide the date range and counts under the title", async () => {
    const shown = await render(DEFAULT_DESIGN_SETTINGS);
    const hidden = await render(design({ showLookbackLine: false }));
    expect(shown).toMatch(/[A-Z][a-z]{2} \d+ – [^<]*\d{4} · \d+ new/);
    expect(hidden).not.toMatch(/ · \d+ new/);
  });

  it("groups a series' new episodes into one row by default, and lists them separately when that's off", async () => {
    const episodes = [1, 2, 3].map((n) =>
      item({ id: `e${n}`, title: "Night Shift", kind: "tv_episode", subtitle: `S02E0${n} - Part ${n}` }),
    );
    const grouped = await render(DEFAULT_DESIGN_SETTINGS, { items: episodes });
    expect(grouped).toContain("3 new episodes");
    expect(grouped.match(/>Night Shift[ <]/g)).toHaveLength(1);
    expect(grouped).toContain("S02E03 - Part 3");

    const separate = await render(design({ sections: { groupEpisodes: false } }), { items: episodes });
    expect(separate).not.toContain("new episodes");
    expect(separate.match(/>Night Shift[ <]/g)).toHaveLength(3);
  });

  it("puts TV episodes and seasons in one TV section", async () => {
    const html = await render(DEFAULT_DESIGN_SETTINGS, {
      items: [item({ title: "Ep", kind: "tv_episode" }), item({ title: "Se", kind: "tv_season" })],
    });
    expect(html.match(/>TV</g)).toHaveLength(1);
    expect(html).not.toContain("TV episodes");
  });

  it("says there's nothing new when no section would appear", async () => {
    const html = await render(DEFAULT_DESIGN_SETTINGS, { items: [] });
    expect(html).toContain("No new items in this period.");
    const withSource = await render(DEFAULT_DESIGN_SETTINGS, {
      items: [],
      sourceLinksByContentType: { movie: "https://plex.example" },
    });
    expect(withSource).not.toContain("No new items in this period.");
    expect(withSource).toContain("Nothing new this time.");
  });

  it("caps the number of items when a limit is set", async () => {
    const html = await render(design({ sections: { groupByType: false, limit: 1 } }));
    expect(html).toContain("A Movie");
    expect(html).not.toContain("A Book");
  });

  describe("grouped by content type", () => {
    const links = { movie: "https://plex.example", book: "https://books.example", game: "https://games.example" };

    it("gives each type with new items its own heading, in the chosen order", async () => {
      const html = await render(design({ sections: { groupByType: true, order: ["book", "movie", "game"] } }), {
        sourceLinksByContentType: links,
      });
      expect(html.indexOf(">Books<")).toBeGreaterThan(-1);
      expect(html.indexOf(">Books<")).toBeLessThan(html.indexOf(">Movies<"));
    });

    it("says there's nothing new for a linked type with no items, and leaves unlinked types out", async () => {
      const html = await render(design({ sections: { groupByType: true, empty: "message" } }), {
        sourceLinksByContentType: links,
      });
      expect(html).toContain(">Games<");
      expect(html).toContain("Nothing new this time.");
      expect(html).not.toContain(">Audiobooks<");
    });

    it("hides empty sections entirely when asked", async () => {
      const html = await render(design({ sections: { groupByType: true, empty: "hide" } }), {
        sourceLinksByContentType: links,
      });
      expect(html).not.toContain(">Games<");
      expect(html).not.toContain("Nothing new this time.");
    });

    it("links to the library for an empty section", async () => {
      const html = await render(design({ sections: { groupByType: true, empty: "link" } }), {
        sourceLinksByContentType: links,
      });
      expect(html).toContain('href="https://games.example"');
      expect(html).toContain("Browse games");
    });

    // #292: it was a bare link in a fixed colour, not one of the design's buttons.
    it("shows the library link as a button in the design's own accent, under a short message", async () => {
      const html = await render(
        design({ colors: { accent: "#1a7f5a" }, sections: { groupByType: true, empty: "link" } }),
        { sourceLinksByContentType: links },
      );
      const games = html.slice(html.indexOf(">Games<"));
      expect(games).toContain("Nothing new this time.");
      expect(games.indexOf("Nothing new this time.")).toBeLessThan(games.indexOf("Browse games"));
      expect(games).toMatch(/<a\s+href="https:\/\/games\.example"[^>]*color:#1a7f5a/);
      expect(games).toContain("border:1px solid #1a7f5a");
      expect(html).not.toContain("#c31d4c");
      expect(html).not.toContain("&rarr;");
    });

    it("leaves out the library button when the section already has its source buttons", async () => {
      const html = await render(
        design({
          sections: { groupByType: true, empty: "link" },
          content: { sourceButtons: { enabled: true, placement: "sections" } },
        }),
        {
          sourceLinksByContentType: links,
          sourceButtons: [{ label: "Play on RomM", url: "https://games.example", kinds: ["game"] }],
        },
      );
      expect(html).toContain("Play on RomM");
      expect(html).not.toContain("Browse games");
    });

    it("fills an empty section with library picks, marked as such", async () => {
      const oldGame = item({ kind: "game", title: "An Old Game" });
      const html = await render(design({ sections: { groupByType: true, empty: "random" } }), {
        sourceLinksByContentType: links,
        fallbackItems: [oldGame],
      });
      expect(html).toContain("An Old Game");
      expect(html).toContain("From the library");
    });
  });

  // #290: Markdown in the notes, links in the design's accent, and each
  // note's alignment.
  it("formats the intro and footer note, with their own alignment", async () => {
    const settings = design({
      colors: { accent: "#1A7F5A" },
      content: {
        intro: "**Big** week. See [the list](https://list.example)",
        introAlign: "center",
        footerNote: "Thanks!",
        footerAlign: "right",
      },
    });
    const html = await render(settings, designContentVariables(settings));
    expect(html).toContain('<strong>Big</strong> week. See <a href="https://list.example" style="color:#1a7f5a;');
    expect(html).toMatch(/text-align:center;[^"]*"\s*><strong>Big<\/strong>/);
    expect(html).toMatch(/text-align:right;[^"]*"\s*>Thanks!</);
  });

  it("keeps notes left-aligned by default", () => {
    expect(DEFAULT_DESIGN_SETTINGS.content).toMatchObject({ introAlign: "left", footerAlign: "left" });
  });

  describe("buttons", () => {
    const ctas = [{ label: "Request something", url: "https://requests.example" }];
    const sourceButtons = [
      { label: "Watch on Plex", url: "https://plex.example", kinds: ["movie", "tv_episode", "tv_season"] },
      { label: "Read on BookLore", url: "https://books.example", kinds: ["book"] },
    ];
    const context = {
      ctas,
      introText: "Hello there",
      footerNote: "See you soon",
      sourceButtons,
      sourceLinksByContentType: { movie: "https://plex.example", book: "https://books.example" },
    };
    const order = (html: string, ...markers: string[]) => markers.map((marker) => html.indexOf(marker));
    const ascending = (positions: number[]) => positions.every((pos, i) => pos > -1 && (i === 0 || pos > positions[i - 1]!));

    it("puts your buttons after the intro, and a button per source after the items, by default", async () => {
      const html = await render(DEFAULT_DESIGN_SETTINGS, context);
      expect(ascending(order(html, "Hello there", "Request something", "A Movie", "A Book", "Watch on Plex", "See you soon"))).toBe(true);
      expect(html).toContain('href="https://plex.example"');
      expect(html).toContain("Read on BookLore");
    });

    it("can put your buttons above the intro or at the very end", async () => {
      const before = await render(design({ content: { ctaPlacement: "beforeIntro" } }), context);
      expect(ascending(order(before, "Weekly Digest", "Request something", "Hello there"))).toBe(true);
      const end = await render(design({ content: { ctaPlacement: "end" } }), context);
      expect(ascending(order(end, "Hello there", "A Book", "See you soon", "Request something"))).toBe(true);
    });

    it("puts each source's button under the sections it provides", async () => {
      const html = await render(
        design({ sections: { groupByType: true, order: ["movie", "book"] }, content: { sourceButtons: { placement: "sections" } } }),
        context,
      );
      expect(ascending(order(html, ">Movies<", "A Movie", "Watch on Plex", ">Books<", "A Book", "Read on BookLore"))).toBe(true);
    });

    it("puts source buttons near the top, or leaves them out", async () => {
      const top = await render(design({ content: { sourceButtons: { placement: "top" } } }), context);
      expect(ascending(order(top, "Request something", "Watch on Plex", "A Movie"))).toBe(true);
      const off = await render(design({ content: { sourceButtons: { enabled: false } } }), context);
      expect(off).not.toContain("Watch on Plex");
    });

    it("renders no button markup when there are none", async () => {
      const html = await render(DEFAULT_DESIGN_SETTINGS);
      expect(html).not.toContain("Watch on");
    });
  });

  it("adds a Most watched section from the popular pool", async () => {
    const popular = item({ title: "Everyone Watched This" });
    const html = await render(design({ sections: { mostWatched: { enabled: true, count: 3 } } }), {
      popularItems: [popular],
    });
    expect(html).toContain(">Most watched<");
    expect(html).toContain("Everyone Watched This");
  });

  it("inlines custom CSS, with anything that could break out of the style block removed", async () => {
    const css = "table { letter-spacing: 1px; } </mj-style><mj-raw>{{newsletterName}}";
    const mjml = buildDesignMjml(design({ customCss: css }));
    expect(mjml).not.toContain("</mj-style><");
    expect(mjml).not.toContain("{{newsletterName}}</mj-style>");
    const html = await render(design({ customCss: css }));
    expect(html).toMatch(/style="[^"]*letter-spacing: 1px/);
  });

  it("escapes item text in every layout", async () => {
    const nasty = item({ title: "<script>alert(1)</script>" });
    for (const layout of ["cards", "compact", "grid"] as const) {
      const html = await render(design({ layout }), { items: [nasty] });
      expect(html).not.toContain("<script>alert(1)</script>");
      expect(html).toContain("&lt;script&gt;");
    }
  });
});

describe("renderDesignSample", () => {
  it("renders a design with made-up content and inline poster images", async () => {
    const html = await renderDesignSample(design({ sections: { groupByType: true } }));
    expect(html).toContain("Sample newsletter");
    expect(html).toContain("The Quiet Harbour");
    expect(html).toContain("data:image/svg+xml;base64,");
    expect(html).toContain(">Audiobooks<");
  });
});
