import { describe, expect, it } from "vitest";
import { htmlToPlainText, summaryText } from "./plain-text.js";

// #461: Audiobookshelf (and others) keep summaries as HTML.
describe("summaryText", () => {
  it("turns an HTML summary into plain words", () => {
    expect(
      summaryText(
        "<p>A <b>gripping</b> tale of <i>two</i> cities.</p><p>Read by <a href=\"https://x.example\">Jane Doe</a> &amp; friends.</p><br/>",
      ),
    ).toBe("A gripping tale of two cities. Read by Jane Doe & friends.");
  });

  it("keeps list items and headings readable", () => {
    expect(summaryText("<h3>Praise</h3><ul><li>Moving</li><li>Funny</li></ul>")).toBe("Praise Moving Funny");
  });

  it("leaves text with no markup as it was, angle brackets and all", () => {
    expect(summaryText("Plain text, 3 < 5 and 7 > 2.")).toBe("Plain text, 3 < 5 and 7 > 2.");
    expect(summaryText(undefined)).toBeUndefined();
  });

  it("gives nothing for markup with no words", () => {
    expect(summaryText("<p><br/></p>")).toBeUndefined();
  });
});

describe("htmlToPlainText", () => {
  it("keeps the words and links, drops images and styles, and wraps long lines", () => {
    const html = `
      <html><head><style>td { color: red; }</style></head><body>
        <table><tr><td><img src="cid:poster-0" alt="Some Movie cover art" /></td>
        <td><a href="https://plex.example.com/item/1">Some Movie</a>
        <div>${"A long summary sentence that goes on. ".repeat(4)}</div></td></tr></table>
        <a href="https://github.com/jshields-ca/LatestArr">https://github.com/jshields-ca/LatestArr</a>
      </body></html>`;
    const text = htmlToPlainText(html);

    expect(text).toContain("Some Movie [https://plex.example.com/item/1]");
    expect(text).not.toContain("cover art");
    expect(text).not.toContain("color: red");
    expect(text.split("\n").every((line) => line.length <= 78)).toBe(true);
    expect(text.match(/github\.com/g)).toHaveLength(1);
    expect(text).not.toMatch(/\n{3,}/);
  });
});
