import { convert } from "html-to-text";

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
