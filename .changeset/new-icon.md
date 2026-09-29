---
"@latestarr/web": patch
---

**Improved:** LatestArr has a new icon: a postage stamp with an L, lifted off a rose tile. It replaces the envelope and sparkle in the app, the browser tab, and the social previews, and comes in light and dark versions. The app now also has icons for adding it to your phone's or computer's home screen.

<details>
<summary>Technical details</summary>

- Chosen in #269, after four exploration rounds (kept on the `design/icon-exploration` branch).
- `docs/assets/brand/generate.mjs` is the single source for the icon:
  - the brand SVGs (tile, dark, light, maskable, marks, one colour) and PNGs;
  - `apps/web/public` (`favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`);
  - `apps/web/src/components/logo-geometry.ts`, which the in-app `LogoMark` draws from, using per-instance mask IDs.
- `index.html` adds the PNG favicon, the Apple touch icon, and a `manifest.webmanifest`. The browser theme colour moves to `#c31d4c`.
- The social images are rendered from `docs/assets/brand/social-preview.html`: `docs/assets/social-preview.png` (1280×640, GitHub and README) and `docs/assets/brand/og-image.png` (1200×630, the website).
- Usage notes are in `docs/assets/brand/brand.md`.

</details>
