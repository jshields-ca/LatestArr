import { describe, expect, it } from "vitest";

import { withPreviewScheme } from "./email-preview";

// Trimmed from what a design renders (design.ts darkModeHead).
const EMAIL = `<style>
:root { color-scheme: light dark; }
@media (prefers-color-scheme: dark) { [style*="color:#241521"] { color:#f2eef0 !important; } }
@media screen and (prefers-color-scheme:light) { .light-only { display:block; } }
</style>`;

describe("withPreviewScheme", () => {
  it("turns the dark-mode rules off for Light", () => {
    const html = withPreviewScheme(EMAIL, "light");
    expect(html).not.toContain("prefers-color-scheme");
    expect(html).toContain("@media (max-width: -1px) { [style*=");
    expect(html).toContain("@media screen and (min-width: 0px) { .light-only");
  });

  it("turns the dark-mode rules on for Dark, whatever the browser's setting", () => {
    const html = withPreviewScheme(EMAIL, "dark");
    expect(html).toContain("@media (min-width: 0px) { [style*=");
    expect(html).toContain("@media screen and (max-width: -1px) { .light-only");
  });

  it("matches however a template spaces or cases the query", () => {
    expect(withPreviewScheme("@media ( PREFERS-COLOR-SCHEME :Dark ) {}", "dark")).toBe("@media (min-width: 0px) {}");
  });

  it("leaves an email without colour-scheme rules unchanged", () => {
    const html = "<p style=\"color:#000\">Hello</p>";
    expect(withPreviewScheme(html, "dark")).toBe(html);
  });
});
