import { describe, expect, it } from "vitest";
import { htmlToPlainText } from "./plain-text.js";

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
