import Handlebars from "handlebars";
import MarkdownIt from "markdown-it";

// A design's Intro and Footer note (#290): a small, email-safe Markdown
// subset. That's bold, italic, strikethrough, links, line breaks,
// paragraphs, and bulleted or numbered lists. Raw HTML is never passed
// through (html: false escapes it), and headings, images, tables, code,
// and quotes stay off: a design has its own headings, and images in email
// need hosting. People who want full control have code mode.
const markdown = new MarkdownIt("zero", { html: false, breaks: true, linkify: false }).enable([
  "list",
  "newline",
  "emphasis",
  "strikethrough",
  "link",
  "escape",
  "entity",
]);

// Links only to web pages and email addresses; anything else (javascript:,
// data:, a relative path) renders as plain text.
markdown.validateLink = (url) => /^(https?:|mailto:)/i.test(url.trim());

const PARAGRAPH_GAP = "margin:0 0 10px;";

// Email clients ignore most stylesheets, so each tag gets inline styles.
// List items' paragraphs are hidden (a "tight" list), and render nothing.
markdown.renderer.rules.paragraph_open = (tokens, index) =>
  tokens[index]!.hidden ? "" : `<p style="${PARAGRAPH_GAP}">`;
// Inline-block, so a centred or right-aligned note moves the list as a
// whole while its items stay left-aligned beside their bullets.
const LIST_STYLE = "padding-left:20px;display:inline-block;text-align:left;";
markdown.renderer.rules.bullet_list_open = () => `<ul style="${PARAGRAPH_GAP}${LIST_STYLE}">`;
markdown.renderer.rules.ordered_list_open = (tokens, index) => {
  const start = tokens[index]!.attrGet("start");
  return `<ol style="${PARAGRAPH_GAP}${LIST_STYLE}"${start ? ` start="${Number(start)}"` : ""}>`;
};
markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const token = tokens[index]!;
  const linkColor = (env as { linkColor?: string } | undefined)?.linkColor ?? "inherit";
  token.attrSet("style", `color:${linkColor};text-decoration:underline;`);
  token.attrSet("target", "_blank");
  token.attrSet("rel", "noopener");
  return self.renderToken(tokens, index, options);
};

/**
 * Renders a note's Markdown to HTML for an email, with links in
 * `linkColor` (the design's accent). The last block's bottom gap is
 * dropped so the note doesn't add space below itself.
 */
export function renderNote(text: string | undefined, linkColor?: string): Handlebars.SafeString | undefined {
  if (!text?.trim()) return undefined;
  const html = markdown.render(text.replace(/\r\n?/g, "\n"), { linkColor: linkColor?.toLowerCase() }).trim();
  // A one-paragraph note needs no wrapper, so it renders exactly as before.
  const single = html.match(new RegExp(`^<p style="${PARAGRAPH_GAP}">((?:(?!<p[ >])[\\s\\S])*)</p>$`));
  if (single) return new Handlebars.SafeString(single[1]!);
  const last = html.lastIndexOf(PARAGRAPH_GAP);
  return new Handlebars.SafeString(
    last === -1 ? html : html.slice(0, last) + "margin:0;" + html.slice(last + PARAGRAPH_GAP.length),
  );
}
