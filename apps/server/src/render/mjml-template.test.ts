import type { NewItem } from "@latestarr/adapter-core";
import { describe, expect, it } from "vitest";
import { renderMjmlTemplate } from "./mjml-template.js";

function item(overrides: Partial<NewItem> = {}): NewItem {
  return {
    id: "1",
    externalId: "1",
    kind: "movie",
    title: "Some Movie",
    addedAt: new Date("2026-01-15T00:00:00Z"),
    ...overrides,
  };
}

const MJML_SOURCE = `
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text font-size="24px">{{newsletterName}} — Custom</mj-text>
        {{#each items}}
        <mj-text>{{title}}</mj-text>
        {{/each}}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`;

describe("renderMjmlTemplate", () => {
  it("substitutes Handlebars tokens in the MJML source before compiling to HTML", async () => {
    const html = await renderMjmlTemplate(MJML_SOURCE, {
      newsletterName: "Weekly Digest",
      items: [item({ title: "A Movie" }), item({ title: "Another Movie" })],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).toContain("<!doctype html");
    expect(html).toContain("Weekly Digest — Custom");
    expect(html).toContain("A Movie");
    expect(html).toContain("Another Movie");
  });

  it("HTML-escapes item text so a malicious title can't inject markup", async () => {
    const html = await renderMjmlTemplate(MJML_SOURCE, {
      newsletterName: "Weekly Digest",
      items: [item({ title: "<script>alert(1)</script>" })],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("still returns best-effort HTML for a malformed MJML template instead of throwing", async () => {
    const malformed = `<mjml><mj-body><mj-section><mj-column><mj-not-a-real-tag/></mj-column></mj-section></mj-body></mjml>`;

    const html = await renderMjmlTemplate(malformed, {
      newsletterName: "Weekly Digest",
      items: [],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(typeof html).toBe("string");
  });
});
