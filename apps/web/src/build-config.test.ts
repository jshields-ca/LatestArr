import { describe, expect, it } from "vitest";

import { assetsInlineLimit } from "../vite.config";

// #469: an inlined font is a data: URI, which the app's Content Security
// Policy blocks, so fonts are always served as files.
describe("build: assetsInlineLimit", () => {
  it("never inlines a font, however small", () => {
    for (const file of ["plus-jakarta-sans-cyrillic-ext.woff2", "a.woff", "b.TTF", "c.otf"]) {
      expect(assetsInlineLimit(`/node_modules/x/files/${file}`)).toBe(false);
    }
  });

  it("leaves other files to Vite's own limit", () => {
    expect(assetsInlineLimit("/src/assets/logos/plex.svg")).toBeUndefined();
  });
});
