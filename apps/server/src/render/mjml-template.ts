import type { NewItem } from "@latestarr/adapter-core";
import Handlebars from "handlebars";
import mjml2html from "mjml";

// The GrapesJS builder exports MJML source that still contains literal
// Handlebars tokens (e.g. {{#each items}}) for its dynamic blocks — we
// reuse the same data-binding layer as the hardcoded starter template
// rather than inventing a second templating mechanism. {{title}}/etc. use
// Handlebars' default {{}} escaping, not {{{}}}, so item text from a
// source can't inject markup into the compiled HTML.

interface RenderableItem {
  kind: string;
  title: string;
  subtitle?: string;
  overview?: string;
  addedAtFormatted: string;
  releaseDateFormatted?: string;
  posterUrl?: string;
  /** A short badge for a kind MediaKind itself doesn't distinguish, e.g.
   * "Ebook" vs "Comic", or "Audiobook" vs "Podcast" — see NewItem.contentLabel. */
  contentLabel?: string;
  genres?: string;
  rating?: string;
  runtimeFormatted?: string;
  pageCount?: number;
  durationFormatted?: string;
  platform?: string;
  externalUrl?: string;
  /** Set only on an item substituted in by a Media List block's
   * emptyFallback="random" — lets a template's card markup mark it as a
   * suggestion rather than something newly added. */
  isFallback?: boolean;
}

export interface MjmlRenderContext {
  newsletterName: string;
  /** The "latest added" pool, used by a Media List block with sort="added". */
  items: NewItem[];
  /** The "most watched" pool, used by a Media List block with sort="mostWatched".
   * Empty when no linked source supports fetchPopularItems. */
  popularItems?: NewItem[];
  /** An all-time (not lookback-window-limited) pool a Media List block with
   * emptyFallback="random" samples from when its normal pool comes up
   * empty for the period — e.g. "no games added this week, here are 5 to
   * try". Only fetched by the caller when a compiled template actually
   * has such a block, so a newsletter that doesn't use it never pays for
   * the extra source calls. */
  fallbackItems?: NewItem[];
  /** Each content kind's linked source base URL, for a Media List block's
   * emptyFallback="link" — "browse the library yourself" when there's
   * nothing new to show. Keyed by NewItem["kind"]; a kind served by more
   * than one linked source resolves to whichever was resolved first. */
  sourceLinksByContentType?: Record<string, string>;
  generatedAt: Date;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// Shared by runtimeMinutes (movies/TV) and durationSeconds (audiobooks,
// converted to minutes first) so both land on the same "1h 45m" / "45m" shape.
function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatRating(rating: NewItem["rating"]): string | undefined {
  if (!rating) return undefined;
  return `${rating.value}/${rating.scale}`;
}

// isFallback is never set here — the mediaList helper below is the only
// place that flags an item as a fallback suggestion, by spreading it onto
// an already-mapped RenderableItem once it's decided to use it that way.
function toRenderable(item: NewItem): RenderableItem {
  return {
    kind: item.kind,
    title: item.title,
    subtitle: item.subtitle,
    overview: item.overview,
    addedAtFormatted: formatDate(item.addedAt),
    releaseDateFormatted: item.releaseDate ? formatDate(item.releaseDate) : undefined,
    // By the time this runs, a real send has already replaced this with a
    // `cid:...` reference (or dropped it) in apps/server/src/pipeline
    // /embed-images.ts — never a source's own (often credential-bearing)
    // URL. mjml-template.test.ts exercises this field directly with a
    // plain URL, which is fine for testing the template mechanics in
    // isolation.
    posterUrl: item.posterUrl,
    contentLabel: item.contentLabel,
    genres: item.genres?.length ? item.genres.join(", ") : undefined,
    rating: formatRating(item.rating),
    runtimeFormatted: item.runtimeMinutes ? formatMinutes(item.runtimeMinutes) : undefined,
    pageCount: item.pageCount,
    durationFormatted: item.durationSeconds
      ? formatMinutes(Math.round(item.durationSeconds / 60))
      : undefined,
    platform: item.platform,
    externalUrl: item.externalUrl,
  };
}

// Fisher-Yates, used by the mediaList helper's order="random" variant and
// by its emptyFallback="random" substitute pool — a fresh shuffle on every
// render, not a stable/seeded one, since "random" here means "surprise me
// this send," not a reproducible order.
function shuffled<T>(items: T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

// The accent color of LatestArr's own Bloom palette (hsl(343 74% 44%)),
// matching the hardcoded copies in newsletter-template.ts and
// grapesjs-blocks.ts — this one's only use is the emptyFallback="link" flow's
// plain-link markup below.
const ACCENT_COLOR = "#c31d4c";

// The GrapesJS "Media List" block exports its trait values as hash
// arguments on this block helper rather than as a second templating
// mechanism — {{#mediaList contentType="movie" sort="added" count="5"
// order="sequential" showAll="false" emptyFallback="none"}}...{{/mediaList}}.
// The block body is rendered once per matching item, exactly like a
// filtered/sorted/sliced {{#each}}.
Handlebars.registerHelper("mediaList", function mediaList(
  this: {
    items?: RenderableItem[];
    popularItems?: RenderableItem[];
    fallbackItems?: RenderableItem[];
    sourceLinksByContentType?: Record<string, string>;
  },
  options: Handlebars.HelperOptions,
) {
  const { contentType, sort, count, order, showAll, emptyFallback, fallbackCount, fallbackLinkLabel } =
    options.hash as {
      contentType?: string;
      sort?: string;
      count?: number | string;
      order?: string;
      showAll?: boolean | string;
      emptyFallback?: string;
      fallbackCount?: number | string;
      fallbackLinkLabel?: string;
    };

  const matchesContentType = (item: RenderableItem) => !contentType || item.kind === contentType;

  const pool = sort === "mostWatched" ? (this.popularItems ?? []) : (this.items ?? []);
  let filtered = pool.filter(matchesContentType);
  if (order === "random") filtered = shuffled(filtered);

  const isShowAll = showAll === true || showAll === "true";
  const limit = Number(count);
  let selected = isShowAll
    ? filtered
    : filtered.slice(0, Number.isFinite(limit) && limit > 0 ? limit : filtered.length);

  if (selected.length === 0 && emptyFallback === "random") {
    const fallbackPool = (this.fallbackItems ?? []).filter(matchesContentType);
    const fallbackLimit = Number(fallbackCount) || (Number.isFinite(limit) && limit > 0 ? limit : 5);
    selected = shuffled(fallbackPool)
      .slice(0, fallbackLimit)
      .map((item) => ({ ...item, isFallback: true }));
  }

  if (selected.length === 0 && emptyFallback === "link") {
    const href = contentType ? this.sourceLinksByContentType?.[contentType] : undefined;
    if (!href) return "";
    const label = Handlebars.escapeExpression(fallbackLinkLabel || "Browse the library");
    // Must be wrapped in its own <mj-raw> here — unlike the per-item body
    // (options.fn's own <mj-raw>...</mj-raw>, supplied by the block's own
    // toHTML), this string substitutes directly into the compiled MJML at
    // the {{#mediaList}}/{{/mediaList}} site, sitting straight inside an
    // <mj-column> — the same "bare non-mj-tag HTML gets silently dropped"
    // trap documented in newsletter-template.ts and grapesjs-blocks.ts.
    return (
      `<mj-raw><a href="${Handlebars.escapeExpression(href)}" ` +
      `style="color:${ACCENT_COLOR};font-family:sans-serif;font-size:14px;font-weight:600;">` +
      `${label} &rarr;</a></mj-raw>`
    );
  }

  return selected.map((item) => options.fn(item)).join("");
});

export async function renderMjmlTemplate(
  mjmlSource: string,
  context: MjmlRenderContext,
): Promise<string> {
  const substitutedMjml = Handlebars.compile(mjmlSource)({
    newsletterName: context.newsletterName,
    items: context.items.map(toRenderable),
    popularItems: (context.popularItems ?? []).map(toRenderable),
    fallbackItems: (context.fallbackItems ?? []).map(toRenderable),
    sourceLinksByContentType: context.sourceLinksByContentType ?? {},
    generatedAtFormatted: formatDate(context.generatedAt),
  });

  // A template saved from the builder before it's ever had an initial
  // design loaded exports a bare fragment (just its section/column
  // content, no root element) — mjml2html rejects that outright, even
  // under "soft" validation, rather than returning best-effort HTML. Wrap
  // it the same way a template built from scratch in the editor ends up
  // wrapped, so a truly bare-bones custom template still renders instead
  // of failing the whole send.
  const wrappedMjml = /^\s*<mjml[\s>]/.test(substitutedMjml)
    ? substitutedMjml
    : `<mjml><mj-body>${substitutedMjml}</mj-body></mjml>`;

  // "soft" validation still returns best-effort HTML for a malformed
  // custom template rather than aborting the send outright — a user's
  // builder mistake shouldn't take down a newsletter that otherwise has
  // real content to deliver.
  const { html } = await mjml2html(wrappedMjml, { validationLevel: "soft" });
  return html;
}
