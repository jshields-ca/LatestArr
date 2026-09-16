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
  posterUrl?: string;
  genres?: string;
  rating?: string;
  runtimeFormatted?: string;
  pageCount?: number;
  durationFormatted?: string;
  platform?: string;
  externalUrl?: string;
}

export interface MjmlRenderContext {
  newsletterName: string;
  /** The "latest added" pool, used by a Media List block with sort="added". */
  items: NewItem[];
  /** The "most watched" pool, used by a Media List block with sort="mostWatched".
   * Empty when no linked source supports fetchPopularItems. */
  popularItems?: NewItem[];
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

function toRenderable(item: NewItem): RenderableItem {
  return {
    kind: item.kind,
    title: item.title,
    subtitle: item.subtitle,
    overview: item.overview,
    addedAtFormatted: formatDate(item.addedAt),
    posterUrl: item.posterUrl,
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

// The GrapesJS "Media List" block exports its trait values (content type,
// sort, count) as hash arguments on this block helper rather than as a
// second templating mechanism — {{#mediaList contentType="movie"
// sort="added" count="5"}}...{{/mediaList}}. The block body is rendered
// once per matching item, exactly like a filtered/sorted/sliced {{#each}}.
Handlebars.registerHelper("mediaList", function mediaList(
  this: { items?: RenderableItem[]; popularItems?: RenderableItem[] },
  options: Handlebars.HelperOptions,
) {
  const { contentType, sort, count } = options.hash as {
    contentType?: string;
    sort?: string;
    count?: number | string;
  };

  const pool = sort === "mostWatched" ? (this.popularItems ?? []) : (this.items ?? []);
  const filtered = contentType ? pool.filter((item) => item.kind === contentType) : pool;
  const limit = Number(count);
  const sliced = filtered.slice(0, Number.isFinite(limit) && limit > 0 ? limit : filtered.length);

  return sliced.map((item) => options.fn(item)).join("");
});

export async function renderMjmlTemplate(
  mjmlSource: string,
  context: MjmlRenderContext,
): Promise<string> {
  const substitutedMjml = Handlebars.compile(mjmlSource)({
    newsletterName: context.newsletterName,
    items: context.items.map(toRenderable),
    popularItems: (context.popularItems ?? []).map(toRenderable),
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
