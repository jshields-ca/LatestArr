import type { NewItem } from "@latestarr/adapter-core";
import { describe, expect, it } from "vitest";
import { renderMjmlTemplate } from "./mjml-template.js";

function item(overrides: Partial<NewItem> = {}): NewItem {
  return {
    id: "1",
    externalId: "1",
    kind: "movie",
    title: "Some Movie",
    addedAt: new Date("2026-01-15T00:00:00Z"),
    ...overrides,
  };
}

const MJML_SOURCE = `
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text font-size="24px">{{newsletterName}} — Custom</mj-text>
        {{#each items}}
        <mj-text>{{title}}</mj-text>
        {{/each}}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`;

describe("renderMjmlTemplate", () => {
  it("substitutes Handlebars tokens in the MJML source before compiling to HTML", async () => {
    const html = await renderMjmlTemplate(MJML_SOURCE, {
      newsletterName: "Weekly Digest",
      items: [item({ title: "A Movie" }), item({ title: "Another Movie" })],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).toContain("<!doctype html");
    expect(html).toContain("Weekly Digest — Custom");
    expect(html).toContain("A Movie");
    expect(html).toContain("Another Movie");
  });

  it("HTML-escapes item text so a malicious title can't inject markup", async () => {
    const html = await renderMjmlTemplate(MJML_SOURCE, {
      newsletterName: "Weekly Digest",
      items: [item({ title: "<script>alert(1)</script>" })],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("still returns best-effort HTML for a malformed MJML template instead of throwing", async () => {
    const malformed = `<mjml><mj-body><mj-section><mj-column><mj-not-a-real-tag/></mj-column></mj-section></mj-body></mjml>`;

    const html = await renderMjmlTemplate(malformed, {
      newsletterName: "Weekly Digest",
      items: [],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(typeof html).toBe("string");
  });

  it("wraps a bare fragment with no <mjml> root instead of throwing (a template saved before its first design load)", async () => {
    const bareFragment = `<mj-section><mj-column><mj-text>{{newsletterName}}</mj-text></mj-column></mj-section>`;

    const html = await renderMjmlTemplate(bareFragment, {
      newsletterName: "Weekly Digest",
      items: [],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).toContain("<!doctype html");
    expect(html).toContain("Weekly Digest");
  });
});

const MEDIA_LIST_MJML = `
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        {{#mediaList contentType="movie" sort="added" count="2"}}
        <mj-text>{{title}}</mj-text>
        {{/mediaList}}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`;

const CARD_MJML = `
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-raw>
        {{#mediaList contentType="movie" sort="added" count="5"}}
        <table><tr>
        {{#if posterUrl}}<td><img src="{{posterUrl}}" alt="{{title}} cover art" /></td>{{/if}}
        <td>{{title}} {{#if runtimeFormatted}}{{runtimeFormatted}}{{/if}}{{#if rating}} · {{rating}}{{/if}}</td>
        </tr></table>
        {{/mediaList}}
        </mj-raw>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`;

describe("poster and metadata fields on rendered items", () => {
  it("exposes posterUrl, a formatted runtime, and a formatted rating to the template", async () => {
    const html = await renderMjmlTemplate(CARD_MJML, {
      newsletterName: "Weekly Digest",
      items: [
        item({
          title: "A Movie",
          posterUrl: "https://example.com/poster.jpg",
          runtimeMinutes: 105,
          rating: { source: "tmdb", value: 7.8, scale: 10 },
        }),
      ],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).toContain('src="https://example.com/poster.jpg"');
    expect(html).toContain('alt="A Movie cover art"');
    expect(html).toContain("1h 45m");
    expect(html).toContain("7.8/10");
  });

  it("omits the poster image entirely when an item has no posterUrl", async () => {
    const html = await renderMjmlTemplate(CARD_MJML, {
      newsletterName: "Weekly Digest",
      items: [item({ title: "No Poster Movie" })],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).not.toContain("<img");
    expect(html).toContain("No Poster Movie");
  });

  it("formats a runtime under an hour as minutes only", async () => {
    const html = await renderMjmlTemplate(CARD_MJML, {
      newsletterName: "Weekly Digest",
      items: [item({ title: "Short Film", runtimeMinutes: 45 })],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).toContain("45m");
    expect(html).not.toContain("0h");
  });
});

// Mirrors the actual shape apps/web/src/lib/grapesjs-blocks.ts's media-list
// component type exports (one <mj-raw> pair per rendered item, nested right
// inside the {{#mediaList}}/{{/mediaList}} block), rather than hand-writing
// a fixture that's already careful to wrap things correctly — this is the
// regression guard for a real bug: MJML's compiler silently drops a bare
// <table> placed directly under <mj-column> (it isn't one of MJML's own
// recognized component tags there) instead of raising an error under
// "soft" validation, so the previous, unwrapped version of this markup
// compiled without any thrown error yet produced a template that rendered
// with an empty section in the actually-sent email.
const UNWRAPPED_TABLE_MJML = `
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        {{#mediaList contentType="movie" sort="added" count="5"}}
        <table><tr><td>{{title}}</td></tr></table>
        {{/mediaList}}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`;

const MJ_RAW_WRAPPED_TABLE_MJML = UNWRAPPED_TABLE_MJML.replace(
  "<table><tr><td>{{title}}</td></tr></table>",
  "<mj-raw><table><tr><td>{{title}}</td></tr></table></mj-raw>",
);

describe("mediaList output must survive real MJML compilation, not just look right pre-compile", () => {
  it("silently drops a <table> placed directly under <mj-column> with no thrown error (the bug)", async () => {
    const html = await renderMjmlTemplate(UNWRAPPED_TABLE_MJML, {
      newsletterName: "Weekly Digest",
      items: [item({ title: "Ghost Movie" })],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).not.toContain("Ghost Movie");
  });

  it("passes the <table> through untouched once it's wrapped in <mj-raw> (the fix)", async () => {
    const html = await renderMjmlTemplate(MJ_RAW_WRAPPED_TABLE_MJML, {
      newsletterName: "Weekly Digest",
      items: [item({ title: "Real Movie" })],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).toContain("Real Movie");
  });
});

describe("the mediaList block helper", () => {
  it("filters the 'added' pool by content type and truncates to count", async () => {
    const html = await renderMjmlTemplate(MEDIA_LIST_MJML, {
      newsletterName: "Weekly Digest",
      items: [
        item({ title: "Movie One", kind: "movie" }),
        item({ title: "A Show", kind: "tv_episode" }),
        item({ title: "Movie Two", kind: "movie" }),
        item({ title: "Movie Three", kind: "movie" }),
      ],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).toContain("Movie One");
    expect(html).toContain("Movie Two");
    expect(html).not.toContain("Movie Three");
    expect(html).not.toContain("A Show");
  });

  it("reads from the popularItems pool when sort is mostWatched", async () => {
    const mostWatchedMjml = MEDIA_LIST_MJML.replace('sort="added"', 'sort="mostWatched"');

    const html = await renderMjmlTemplate(mostWatchedMjml, {
      newsletterName: "Weekly Digest",
      items: [item({ title: "Recently Added Movie", kind: "movie" })],
      popularItems: [item({ title: "Most Watched Movie", kind: "movie" })],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).toContain("Most Watched Movie");
    expect(html).not.toContain("Recently Added Movie");
  });

  it("renders nothing for a content type with no matches instead of throwing", async () => {
    const html = await renderMjmlTemplate(MEDIA_LIST_MJML, {
      newsletterName: "Weekly Digest",
      items: [item({ title: "A Show", kind: "tv_episode" })],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).not.toContain("A Show");
  });
});

describe("the mediaList block helper's showAll variant", () => {
  it("ignores count entirely and renders every matching item when showAll is true", async () => {
    const mjml = MEDIA_LIST_MJML.replace('count="2"', 'count="2" showAll="true"');

    const html = await renderMjmlTemplate(mjml, {
      newsletterName: "Weekly Digest",
      items: [
        item({ title: "Movie One", kind: "movie" }),
        item({ title: "Movie Two", kind: "movie" }),
        item({ title: "Movie Three", kind: "movie" }),
      ],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).toContain("Movie One");
    expect(html).toContain("Movie Two");
    expect(html).toContain("Movie Three");
  });
});

describe("the mediaList block helper's order=\"random\" variant", () => {
  it("still renders exactly `count` items, just not necessarily the first ones", async () => {
    const mjml = MEDIA_LIST_MJML.replace('count="2"', 'count="2" order="random"');

    const html = await renderMjmlTemplate(mjml, {
      newsletterName: "Weekly Digest",
      items: [
        item({ title: "Movie One", kind: "movie" }),
        item({ title: "Movie Two", kind: "movie" }),
        item({ title: "Movie Three", kind: "movie" }),
      ],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    const renderedCount = ["Movie One", "Movie Two", "Movie Three"].filter((title) =>
      html.includes(title),
    ).length;
    expect(renderedCount).toBe(2);
  });
});

describe("the mediaList block helper's emptyFallback variant", () => {
  const FALLBACK_MJML = `
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        {{#mediaList contentType="game" sort="added" count="5" emptyFallback="random" fallbackCount="2"}}
        <mj-text>{{title}}{{#if isFallback}} (suggested){{/if}}</mj-text>
        {{/mediaList}}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`;

  it("substitutes random items from fallbackItems when the normal pool is empty", async () => {
    const html = await renderMjmlTemplate(FALLBACK_MJML, {
      newsletterName: "Weekly Digest",
      items: [],
      fallbackItems: [
        item({ title: "Old Game One", kind: "game" }),
        item({ title: "Old Game Two", kind: "game" }),
        item({ title: "Old Game Three", kind: "game" }),
      ],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    const renderedCount = ["Old Game One", "Old Game Two", "Old Game Three"].filter((title) =>
      html.includes(title),
    ).length;
    expect(renderedCount).toBe(2);
    expect(html).toContain("(suggested)");
  });

  it("does not use the fallback pool when the normal pool already has items", async () => {
    const html = await renderMjmlTemplate(FALLBACK_MJML, {
      newsletterName: "Weekly Digest",
      items: [item({ title: "New Game", kind: "game" })],
      fallbackItems: [item({ title: "Old Game", kind: "game" })],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).toContain("New Game");
    expect(html).not.toContain("Old Game");
    expect(html).not.toContain("(suggested)");
  });

  it("renders nothing when both the normal and fallback pools are empty", async () => {
    const html = await renderMjmlTemplate(FALLBACK_MJML, {
      newsletterName: "Weekly Digest",
      items: [],
      fallbackItems: [],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).not.toContain("(suggested)");
  });

  const LINK_MJML = `
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        {{#mediaList contentType="game" sort="added" count="5" emptyFallback="link" fallbackLinkLabel="Browse RomM"}}
        <mj-text>{{title}}</mj-text>
        {{/mediaList}}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`;

  it("renders a link to the source when emptyFallback is link and a source URL is known", async () => {
    const html = await renderMjmlTemplate(LINK_MJML, {
      newsletterName: "Weekly Digest",
      items: [],
      sourceLinksByContentType: { game: "http://romm.local:3000" },
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).toContain('href="http://romm.local:3000"');
    expect(html).toContain("Browse RomM");
  });

  it("renders nothing when emptyFallback is link but no source URL is known for that content type", async () => {
    const html = await renderMjmlTemplate(LINK_MJML, {
      newsletterName: "Weekly Digest",
      items: [],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).not.toContain("<a href");
  });
});

describe("releaseDateFormatted and contentLabel on rendered items", () => {
  const CARD_WITH_DETAILS_MJML = `
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        {{#mediaList contentType="book" sort="added" count="5"}}
        <mj-text>{{title}} {{#if contentLabel}}[{{contentLabel}}]{{/if}} - Added {{addedAtFormatted}}{{#if releaseDateFormatted}}, released {{releaseDateFormatted}}{{/if}}</mj-text>
        {{/mediaList}}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`;

  it("exposes both a formatted release date and the added date", async () => {
    const html = await renderMjmlTemplate(CARD_WITH_DETAILS_MJML, {
      newsletterName: "Weekly Digest",
      items: [
        item({
          title: "Some Comic",
          kind: "book",
          contentLabel: "Comic",
          releaseDate: new Date("2020-05-01T00:00:00Z"),
        }),
      ],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).toContain("[Comic]");
    expect(html).toContain("released May 1, 2020");
    expect(html).toContain("Added January 15, 2026");
  });
});
