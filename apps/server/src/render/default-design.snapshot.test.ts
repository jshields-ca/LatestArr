import type { NewItem } from "@latestarr/adapter-core";
import { describe, expect, it } from "vitest";
import { renderDefaultNewsletterHtml } from "./newsletter-template.js";

// Locks the Default design's exact output (last changed on purpose by the
// refresh in #219), so an unintended change to what existing newsletters
// look like fails here. Update them (vitest -u) only for a deliberate
// visual change.

const generatedAt = new Date("2026-01-20T12:00:00Z");

const richItems: NewItem[] = [
  {
    id: "1",
    externalId: "1",
    kind: "movie",
    title: "Some <Movie>",
    subtitle: "Director's cut",
    overview: "An overview.",
    posterUrl: "cid:poster-0@latestarr",
    externalUrl: "https://app.plex.tv/desktop#!/details/1",
    runtimeMinutes: 105,
    rating: { source: "tmdb", value: 8.1, scale: 10 },
    releaseDate: new Date("2025-11-02T12:00:00Z"),
    addedAt: new Date("2026-01-15T12:00:00Z"),
  },
  {
    id: "2",
    externalId: "2",
    kind: "book",
    title: "A Book",
    contentLabel: "Ebook",
    pageCount: 320,
    addedAt: new Date("2026-01-16T12:00:00Z"),
  },
];

describe("default design output", () => {
  it("matches the recorded default layout with every field present", async () => {
    const html = await renderDefaultNewsletterHtml({
      newsletterName: "Weekly Digest",
      items: richItems,
      generatedAt,
      lookbackDays: 7,
      emailFont: "georgia",
      introText: "Hello & welcome.",
      footerNote: "See you next week.",
      ctas: [{ label: "Open Plex", url: "https://app.plex.tv/desktop" }],
    });
    await expect(html).toMatchFileSnapshot("./__snapshots__/default-design-full.html");
  });

  it("matches the recorded empty-issue layout", async () => {
    const html = await renderDefaultNewsletterHtml({ newsletterName: "Weekly Digest", items: [], generatedAt });
    await expect(html).toMatchFileSnapshot("./__snapshots__/default-design-empty.html");
  });
});
