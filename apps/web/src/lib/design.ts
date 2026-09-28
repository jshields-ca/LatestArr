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

export interface DesignSettings {
  font: string;
  colors: { accent: string; background: string; text: string; muted: string };
  showLookbackLine: boolean;
  layout: DesignLayout;
  show: { poster: boolean; badge: boolean; subtitle: boolean; details: boolean; overview: boolean; dates: boolean };
  sections: {
    groupByType: boolean;
    order: DesignKind[];
    limit: number | null;
    empty: DesignEmptySection;
    mostWatched: { enabled: boolean; count: number };
  };
  content: { intro: string; footerNote: string; ctas: DesignCta[] };
  customCss: string;
}

export const DESIGN_KIND_LABELS: Record<DesignKind, string> = {
  movie: "Movies",
  tv_episode: "TV episodes",
  tv_season: "TV seasons",
  book: "Books",
  audiobook: "Audiobooks",
  game: "Games",
};

export const DEFAULT_DESIGN_SETTINGS: DesignSettings = {
  font: "ubuntu",
  colors: { accent: "#c31d4c", background: "#ffffff", text: "#241521", muted: "#7c5a68" },
  showLookbackLine: true,
  layout: "cards",
  show: { poster: true, badge: true, subtitle: true, details: true, overview: true, dates: true },
  sections: {
    groupByType: false,
    order: ["movie", "tv_episode", "tv_season", "book", "audiobook", "game"],
    limit: null,
    empty: "message",
    mostWatched: { enabled: false, count: 5 },
  },
  content: { intro: "", footerNote: "", ctas: [] },
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
    show: { ...DEFAULT_DESIGN_SETTINGS.show, ...value.show },
    sections: {
      ...DEFAULT_DESIGN_SETTINGS.sections,
      ...value.sections,
      mostWatched: { ...DEFAULT_DESIGN_SETTINGS.sections.mostWatched, ...value.sections?.mostWatched },
    },
    content: { ...DEFAULT_DESIGN_SETTINGS.content, ...value.content },
  };
}

// A button is saved only with a label and a full http(s) link; the server
// rejects anything else.
export function isCompleteCta(cta: DesignCta): boolean {
  if (!cta.label.trim()) return false;
  try {
    const url = new URL(cta.url);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
