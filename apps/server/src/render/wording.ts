import type { NewItem } from "@latestarr/adapter-core";

// The words a design can change (#390): what each section is called, and
// which way round dates go. Gathered here so the email, its subject and the
// editor's sample all use the same, and so a later translation has one
// place to start from.

export type DateOrder = "monthFirst" | "dayFirst";

/** A grouped design's sections. TV covers episodes and seasons. */
export const SECTION_NAME_KEYS = ["movie", "tv", "book", "audiobook", "game"] as const;
export type SectionNameKey = (typeof SECTION_NAME_KEYS)[number];

/** As a design stores them: blank keeps the default. */
export type SectionNameSettings = Record<SectionNameKey, { plural: string; singular: string }>;

const DEFAULT_NAMES: Record<SectionNameKey, { plural: string; singular: string | null }> = {
  movie: { plural: "Movies", singular: "Movie" },
  // Counted as episodes and seasons, never as "TVs".
  tv: { plural: "TV", singular: null },
  book: { plural: "Books", singular: "Book" },
  audiobook: { plural: "Audiobooks", singular: "Audiobook" },
  game: { plural: "Games", singular: "Game" },
};

const COUNTED_KINDS: Record<Exclude<SectionNameKey, "tv">, NewItem["kind"]> = {
  movie: "movie",
  book: "book",
  audiobook: "audiobook",
  game: "game",
};

const DEFAULT_COUNT_LABELS: Record<NewItem["kind"], [string, string]> = {
  movie: ["movie", "movies"],
  tv_episode: ["episode", "episodes"],
  tv_season: ["season", "seasons"],
  book: ["book", "books"],
  audiobook: ["audiobook", "audiobooks"],
  game: ["game", "games"],
};

// An item's type badge when its source doesn't set one (Plex, Tautulli and
// RomM never do; book apps say Ebook, Comic or Podcast themselves).
const DEFAULT_KIND_LABELS: Record<NewItem["kind"], string> = {
  movie: "Movie",
  tv_episode: "TV Episode",
  tv_season: "TV Season",
  game: "Game",
  book: "Book",
  audiobook: "Audiobook",
};

export interface Wording {
  dateOrder: DateOrder;
  /** An item's badge when its source sets none: "Movie", or "Film" once renamed. */
  kindLabels: Record<NewItem["kind"], string>;
  /** For templates: {{sectionNames.movie.heading}} is "Movies", and
   * {{sectionNames.movie.browse}} "Browse movies". */
  sectionNames: Record<SectionNameKey, { heading: string; browse: string }>;
  /** "9 movies" and "1 movie", by kind. */
  countLabels: Record<NewItem["kind"], [string, string]>;
}

// Mid-sentence: "Browse films", "9 films". A name that starts with two
// capitals (TV, BBC) is left as it is.
function inSentence(name: string): string {
  if (name.length > 1 && name[1] === name[1]!.toUpperCase() && name[1] !== name[1]!.toLowerCase()) return name;
  return name.charAt(0).toLowerCase() + name.slice(1);
}

// "Films" gives "Film" when no singular is given. Anything else ("Telly",
// "Manga") is used for both, which reads "1 manga".
function singularOf(plural: string): string {
  return /[^s]s$/i.test(plural) ? plural.slice(0, -1) : plural;
}

export function buildWording(names?: Partial<SectionNameSettings>, dateOrder: DateOrder = "monthFirst"): Wording {
  const sectionNames = {} as Wording["sectionNames"];
  const countLabels = { ...DEFAULT_COUNT_LABELS };
  const kindLabels = { ...DEFAULT_KIND_LABELS };
  for (const key of SECTION_NAME_KEYS) {
    const chosen = names?.[key];
    const plural = chosen?.plural.trim() || DEFAULT_NAMES[key].plural;
    sectionNames[key] = { heading: plural, browse: `Browse ${inSentence(plural)}` };
    if (key === "tv") continue;
    const custom = Boolean(chosen?.plural.trim() || chosen?.singular.trim());
    if (!custom) continue;
    const singular = chosen?.singular.trim() || (chosen?.plural.trim() ? singularOf(plural) : DEFAULT_NAMES[key].singular!);
    countLabels[COUNTED_KINDS[key]] = [inSentence(singular), inSentence(plural)];
    kindLabels[COUNTED_KINDS[key]] = singular;
  }
  return { dateOrder, kindLabels, sectionNames, countLabels };
}

export const DEFAULT_WORDING: Wording = buildWording();
