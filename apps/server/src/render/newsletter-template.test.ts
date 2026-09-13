import type { NewItem } from "@latestarr/adapter-core";
import { describe, expect, it } from "vitest";
import { renderNewsletterHtml } from "./newsletter-template.js";

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

describe("renderNewsletterHtml", () => {
  it("renders each item's title, subtitle, overview, and formatted date", () => {
    const html = renderNewsletterHtml({
      newsletterName: "Weekly Digest",
      items: [item({ subtitle: "A subtitle", overview: "An overview." })],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).toContain("Weekly Digest");
    expect(html).toContain("Some Movie");
    expect(html).toContain("A subtitle");
    expect(html).toContain("An overview.");
    expect(html).toContain("January 15, 2026");
    expect(html).toContain("January 20, 2026");
  });

  it("shows a fallback message when there are no items", () => {
    const html = renderNewsletterHtml({
      newsletterName: "Weekly Digest",
      items: [],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).toContain("No new items in this period.");
  });

  it("omits the subtitle/overview blocks entirely when absent", () => {
    const html = renderNewsletterHtml({
      newsletterName: "Weekly Digest",
      items: [item()],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).not.toContain("undefined");
  });

  it("HTML-escapes item text so a malicious title can't inject markup", () => {
    const html = renderNewsletterHtml({
      newsletterName: "Weekly Digest",
      items: [item({ title: "<script>alert(1)</script>" })],
      generatedAt: new Date("2026-01-20T00:00:00Z"),
    });

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
