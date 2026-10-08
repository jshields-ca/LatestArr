// Mirrors apps/server/src/render/design.ts's designSettingsSchema. The
// server validates and fills defaults; this copy gives the editor a typed
// shape and a starting point for new designs. Keep the two in sync.

export type DesignKind = "movie" | "tv_episode" | "tv_season" | "book" | "audiobook" | "game";
export type DesignLayout = "cards" | "compact" | "grid";
export type DesignEmptySection = "hide" | "message" | "link" | "random";

export interface DesignCta {
  label: string;
  url: string;
}

export const MAX_DESIGN_CTAS = 4;

export type DesignCtaPlacement = "beforeIntro" | "afterIntro" | "end";
export type DesignSourceButtonPlacement = "top" | "sections" | "end";
export type DesignTextAlign = "left" | "center" | "right";

export interface DesignButtons {
  shape: "square" | "rounded" | "pill";
  style: "filled" | "outline";
  size: "regular" | "small";
}

// A logo at the top (#302): an uploaded image, or an image URL that's
// embedded when sending or linked.
export interface DesignLogo {
  source: "none" | "upload" | "url";
  imageId: string | null;
  darkImageId: string | null;
  url: string | null;
  darkUrl: string | null;
  urlMode: "embed" | "link";
  link: string | null;
  placement: "above" | "replace";
  align: DesignTextAlign;
  maxWidth: number;
  alt: string;
}

// Mirrors the server's LOGO_MIN_WIDTH and LOGO_MAX_WIDTH.
export const LOGO_MIN_WIDTH = 40;
export const LOGO_MAX_WIDTH = 550;

export interface DesignContent {
  // Markdown: bold, italic, links, and lists.
  intro: string;
  introAlign: DesignTextAlign;
  footerNote: string;
  footerAlign: DesignTextAlign;
  ctas: DesignCta[];
  ctaPlacement: DesignCtaPlacement;
  // "Watch on Plex"-style buttons for linked sources with a public URL.
  sourceButtons: { enabled: boolean; placement: DesignSourceButtonPlacement };
}

export interface DesignSettings {
  font: string;
  colors: {
    accent: string;
    background: string;
    text: string;
    muted: string;
    // Advanced: null follows the accent.
    labelText: string | null;
    labelBackground: string | null;
    buttonBackground: string | null;
    buttonText: string | null;
    link: string | null;
  };
  buttons: DesignButtons;
  logo: DesignLogo;
  showLookbackLine: boolean;
  layout: DesignLayout;
  show: { poster: boolean; badge: boolean; subtitle: boolean; details: boolean; overview: boolean; dates: boolean };
  sections: {
    groupByType: boolean;
    groupEpisodes: boolean;
    order: DesignKind[];
    limit: number | null;
    empty: DesignEmptySection;
    mostWatched: { enabled: boolean; count: number };
  };
  content: DesignContent;
  customCss: string;
}

export const DEFAULT_DESIGN_SETTINGS: DesignSettings = {
  font: "ubuntu",
  colors: {
    accent: "#c31d4c",
    background: "#ffffff",
    text: "#241521",
    muted: "#7c5a68",
    labelText: null,
    labelBackground: null,
    buttonBackground: null,
    buttonText: null,
    link: null,
  },
  buttons: { shape: "rounded", style: "filled", size: "regular" },
  logo: {
    source: "none",
    imageId: null,
    darkImageId: null,
    url: null,
    darkUrl: null,
    urlMode: "embed",
    link: null,
    placement: "above",
    align: "left",
    maxWidth: 180,
    alt: "",
  },
  showLookbackLine: true,
  layout: "cards",
  show: { poster: true, badge: true, subtitle: true, details: true, overview: true, dates: true },
  sections: {
    groupByType: true,
    groupEpisodes: true,
    order: ["movie", "tv_episode", "tv_season", "book", "audiobook", "game"],
    limit: null,
    empty: "message",
    mostWatched: { enabled: false, count: 5 },
  },
  content: {
    intro: "",
    introAlign: "left",
    footerNote: "",
    footerAlign: "left",
    ctas: [],
    ctaPlacement: "afterIntro",
    sourceButtons: { enabled: true, placement: "end" },
  },
  customCss: "",
};

// A saved design from an older version may lack newer options; fill them
// from the defaults so the editor always has a complete shape.
export function withDesignDefaults(settings: Partial<DesignSettings> | null | undefined): DesignSettings {
  const value = settings ?? {};
  return {
    ...DEFAULT_DESIGN_SETTINGS,
    ...value,
    colors: { ...DEFAULT_DESIGN_SETTINGS.colors, ...value.colors },
    buttons: { ...DEFAULT_DESIGN_SETTINGS.buttons, ...value.buttons },
    logo: { ...DEFAULT_DESIGN_SETTINGS.logo, ...value.logo },
    show: { ...DEFAULT_DESIGN_SETTINGS.show, ...value.show },
    sections: {
      ...DEFAULT_DESIGN_SETTINGS.sections,
      ...value.sections,
      mostWatched: { ...DEFAULT_DESIGN_SETTINGS.sections.mostWatched, ...value.sections?.mostWatched },
    },
    content: {
      ...DEFAULT_DESIGN_SETTINGS.content,
      ...value.content,
      sourceButtons: { ...DEFAULT_DESIGN_SETTINGS.content.sourceButtons, ...value.content?.sourceButtons },
    },
  };
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// A button is saved only with a label and a full http(s) link; the server
// rejects anything else.
export function isCompleteCta(cta: DesignCta): boolean {
  return Boolean(cta.label.trim()) && isHttpUrl(cta.url);
}

// What's wrong with the logo options, if anything, as the server would
// see it: each URL must be a full http(s) address. Holds back Save.
export function logoProblem(logo: DesignLogo): string | null {
  const bad = (value: string | null) => value !== null && !isHttpUrl(value);
  if (logo.source === "url" && !logo.url) return "Add the logo's image URL, or choose No logo.";
  if (logo.source === "upload" && !logo.imageId) return "Upload a logo image, or choose No logo.";
  if (bad(logo.url) || bad(logo.darkUrl)) return "Image URLs need to start with http:// or https://.";
  if (bad(logo.link)) return "The logo's link needs to start with http:// or https://.";
  return null;
}

// The sections of a grouped newsletter, as the server renders them
// (apps/server/src/render/design.ts SECTIONS): TV episodes and seasons
// share one "TV" section.
export const DESIGN_SECTIONS: { label: string; kinds: DesignKind[] }[] = [
  { label: "Movies", kinds: ["movie"] },
  { label: "TV", kinds: ["tv_episode", "tv_season"] },
  { label: "Books", kinds: ["book"] },
  { label: "Audiobooks", kinds: ["audiobook"] },
  { label: "Games", kinds: ["game"] },
];

// Sections in the design's order: each sits where its first kind is.
export function orderedSections(order: DesignKind[]): { label: string; kinds: DesignKind[] }[] {
  const rank = (kinds: DesignKind[]) =>
    Math.min(...kinds.map((kind) => (order.includes(kind) ? order.indexOf(kind) : order.length)));
  return [...DESIGN_SECTIONS].sort((a, b) => rank(a.kinds) - rank(b.kinds));
}

// Moves one section up or down, returning the new kind order.
export function moveSection(order: DesignKind[], index: number, direction: -1 | 1): DesignKind[] {
  const sections = orderedSections(order);
  const target = index + direction;
  if (target < 0 || target >= sections.length) return order;
  [sections[index], sections[target]] = [sections[target]!, sections[index]!];
  return sections.flatMap((section) => section.kinds);
}
