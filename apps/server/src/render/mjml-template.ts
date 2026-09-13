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
  title: string;
  subtitle?: string;
  overview?: string;
  addedAtFormatted: string;
}

export interface MjmlRenderContext {
  newsletterName: string;
  items: NewItem[];
  generatedAt: Date;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export async function renderMjmlTemplate(
  mjmlSource: string,
  context: MjmlRenderContext,
): Promise<string> {
  const items: RenderableItem[] = context.items.map((item) => ({
    title: item.title,
    subtitle: item.subtitle,
    overview: item.overview,
    addedAtFormatted: formatDate(item.addedAt),
  }));

  const substitutedMjml = Handlebars.compile(mjmlSource)({
    newsletterName: context.newsletterName,
    items,
    generatedAtFormatted: formatDate(context.generatedAt),
  });

  // "soft" validation still returns best-effort HTML for a malformed
  // custom template rather than aborting the send outright — a user's
  // builder mistake shouldn't take down a newsletter that otherwise has
  // real content to deliver.
  const { html } = await mjml2html(substitutedMjml, { validationLevel: "soft" });
  return html;
}
