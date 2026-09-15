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
