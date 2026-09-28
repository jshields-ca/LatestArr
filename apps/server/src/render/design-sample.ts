import type { NewItem } from "@latestarr/adapter-core";
import { buildDesignMjml, DESIGN_KINDS, type DesignSettings, designContentVariables } from "./design.js";
import { renderMjmlTemplate } from "./mjml-template.js";

// Made-up content for previewing a design that isn't attached to a
// newsletter yet. Posters are small inline SVGs so the preview needs no
// network access.
function posterDataUri(fill: string, label: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="176" height="264" viewBox="0 0 176 264">` +
    `<rect width="176" height="264" rx="12" fill="${fill}"/>` +
    `<text x="88" y="140" font-family="Arial, sans-serif" font-size="20" fill="#ffffff" text-anchor="middle">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const DAY = 24 * 60 * 60 * 1000;

function sampleItems(now: Date): NewItem[] {
  return [
    {
      id: "sample-1",
      externalId: "sample-1",
      kind: "movie",
      title: "The Quiet Harbour",
      overview: "A lighthouse keeper finds a message that changes everything she knows about the town.",
      posterUrl: posterDataUri("#3b5b7a", "Movie"),
      runtimeMinutes: 112,
      rating: { source: "sample", value: 7.8, scale: 10 },
      releaseDate: new Date(now.getTime() - 200 * DAY),
      addedAt: new Date(now.getTime() - 1 * DAY),
    },
    {
      id: "sample-2",
      externalId: "sample-2",
      kind: "tv_episode",
      title: "Night Shift",
      subtitle: "S02E05 · The Long Way Home",
      overview: "The crew takes an unexpected detour.",
      posterUrl: posterDataUri("#5b3b7a", "TV"),
      runtimeMinutes: 44,
      addedAt: new Date(now.getTime() - 2 * DAY),
    },
    {
      id: "sample-3",
      externalId: "sample-3",
      kind: "book",
      title: "Gardens of the North",
      subtitle: "A. Lindqvist",
      contentLabel: "Ebook",
      posterUrl: posterDataUri("#3b7a5b", "Book"),
      pageCount: 288,
      addedAt: new Date(now.getTime() - 3 * DAY),
    },
    {
      id: "sample-4",
      externalId: "sample-4",
      kind: "game",
      title: "Pixel Tides",
      platform: "SNES",
      posterUrl: posterDataUri("#7a5b3b", "Game"),
      addedAt: new Date(now.getTime() - 4 * DAY),
    },
  ];
}

export async function renderDesignSample(settings: DesignSettings): Promise<string> {
  const now = new Date();
  const items = sampleItems(now);
  return renderMjmlTemplate(buildDesignMjml(settings), {
    newsletterName: "Sample newsletter",
    items,
    popularItems: items.slice(0, 2),
    fallbackItems: items,
    // Every content type counts as "linked", so the preview also shows how
    // empty sections look (there's no sample audiobook, for example).
    sourceLinksByContentType: Object.fromEntries(DESIGN_KINDS.map((kind) => [kind, "https://example.com/library"])),
    generatedAt: now,
    lookbackDays: 7,
    ...designContentVariables(settings),
  });
}
