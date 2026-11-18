import { convert } from "html-to-text";

// Looks like markup: a tag, or an entity such as &amp; or &#39;.
const LOOKS_LIKE_HTML = /<\/?[a-z][^<>]*>|&(?:[a-z]+|#\d+|#x[\da-f]+);/i;

/**
 * A source's summary as plain words (#461). Some sources keep descriptions
 * as HTML (Audiobookshelf's editor, Jellyfin and Emby overviews, OPDS
 * content), and the email shows them as text, so the tags would appear
 * literally. Paragraphs and line breaks become single spaces, entities
 * become characters, links keep only their text, and images are dropped.
 * Text with no markup is returned as it was.
 */
export function summaryText(value: string | undefined): string | undefined {
  if (!value || !LOOKS_LIKE_HTML.test(value)) return value;
  const text = convert(value, {
    wordwrap: false,
    selectors: [
      { selector: "img", format: "skip" },
      { selector: "a", options: { ignoreHref: true } },
      { selector: "h1", options: { uppercase: false } },
      { selector: "h2", options: { uppercase: false } },
      { selector: "h3", options: { uppercase: false } },
      // An empty prefix falls back to " * ", so a space (collapsed below).
      { selector: "ul", options: { itemPrefix: " " } },
    ],
  })
    .replace(/\s+/g, " ")
    .trim();
  return text || undefined;
}

// The plain-text part sent alongside every newsletter's HTML. Spam filters
// score HTML-only mail worse, and some readers (and screen-reader users
// on text clients) only see this part. Derived from the rendered HTML so
// every design, including hand-written code designs, gets one.
export function htmlToPlainText(html: string): string {
  return convert(html, {
    wordwrap: 78,
    selectors: [
      // Posters are inline attachments; their alt text would only repeat
      // the title right beside them.
      { selector: "img", format: "skip" },
      { selector: "style", format: "skip" },
      // A linked title reads "Title [https://...]"; a bare URL shown as
      // its own text isn't repeated.
      { selector: "a", options: { hideLinkHrefIfSameAsText: true } },
      // Layout tables are MJML scaffolding, not data tables.
      { selector: "table", format: "block" },
      { selector: "tr", format: "block" },
      { selector: "td", format: "block" },
    ],
  })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
