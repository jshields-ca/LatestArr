import { describe, expect, it } from "vitest";
import { renderNote } from "./notes.js";

const render = (text: string) => String(renderNote(text, "#C31D4C"));
const link = (href: string, text: string) =>
  `<a href="${href}" style="color:#c31d4c;text-decoration:underline;" target="_blank" rel="noopener">${text}</a>`;

describe("renderNote", () => {
  it("renders nothing for an empty note", () => {
    expect(renderNote("")).toBeUndefined();
    expect(renderNote("  \n ")).toBeUndefined();
  });

  it("leaves a one-paragraph note unwrapped, as before", () => {
    expect(render("Hello & welcome.")).toBe("Hello &amp; welcome.");
  });

  it("keeps line breaks, and makes paragraphs of blank lines, with no gap after the last (#289)", () => {
    expect(render("Hi all,\r\nNew this week:\n\n\nEnjoy")).toBe(
      '<p style="margin:0 0 10px;">Hi all,<br>\nNew this week:</p>\n<p style="margin:0;">Enjoy</p>',
    );
  });

  it("formats bold, italic, strikethrough and web links in the accent colour", () => {
    expect(render("**Bold**, *it*, ~~gone~~ and [our site](https://example.com)")).toBe(
      `<strong>Bold</strong>, <em>it</em>, <s>gone</s> and ${link("https://example.com", "our site")}`,
    );
    expect(render("[Email me](mailto:admin@example.com)")).toBe(link("mailto:admin@example.com", "Email me"));
  });

  it("renders bulleted and numbered lists", () => {
    expect(render("New:\n\n- one\n- two\n\n3. c\n4. d")).toBe(
      '<p style="margin:0 0 10px;">New:</p>\n' +
        '<ul style="margin:0 0 10px;padding-left:20px;display:inline-block;text-align:left;"><li>one</li>\n<li>two</li>\n</ul>\n' +
        '<ol style="margin:0;padding-left:20px;display:inline-block;text-align:left;" start="3"><li>c</li>\n<li>d</li>\n</ol>',
    );
  });

  it("never passes HTML through, and leaves unsafe or relative links as text", () => {
    expect(render("<b>hi</b> <script>alert(1)</script>")).toBe(
      "&lt;b&gt;hi&lt;/b&gt; &lt;script&gt;alert(1)&lt;/script&gt;",
    );
    expect(render("[x](javascript:alert(1)) [y](data:text/html,hi) [z](/relative)")).toBe(
      "[x](javascript:alert(1)) [y](data:text/html,hi) [z](/relative)",
    );
  });

  it("leaves headings, quotes and code as plain text", () => {
    expect(render("# Title\n> quote\n`code`")).toBe("# Title<br>\n&gt; quote<br>\n`code`");
  });

  it("styles links with inherit when there's no design colour", () => {
    expect(String(renderNote("[a](https://a.example)"))).toContain('style="color:inherit;text-decoration:underline;"');
  });
});
