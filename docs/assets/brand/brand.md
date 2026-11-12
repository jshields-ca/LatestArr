# LatestArr brand assets

The LatestArr mark is a **postage stamp with an L**: "delivered to your inbox", without the stock envelope. It was chosen in [#269](https://github.com/jshields-ca/LatestArr/issues/269), and the rose tile it used to sit on was dropped in [#332](https://github.com/jshields-ca/LatestArr/issues/332), so the stamp fills its space and stays clear at small sizes. The four exploration rounds are archived under the [`archive/icon-exploration`](https://github.com/jshields-ca/LatestArr/tree/archive/icon-exploration/docs/assets/icon-exploration) tag.

Everything here is generated. Change `generate.mjs`, then run:

```bash
node docs/assets/brand/generate.mjs
```

That rewrites the SVGs and PNGs in this folder, the web UI's favicon and app icons (`apps/web/public`), and the geometry the in-app logo draws from (`apps/web/src/components/logo-geometry.ts`).

The social images are rendered from `social-preview.html` in a headless browser, at 1280×640 (`../social-preview.png`, for GitHub and the README) and 1200×630 (`og-image.png`, for latestarr.app's Open Graph and Twitter cards). Pass `?w=&h=` to render other sizes.

## Files

| File | Use |
| --- | --- |
| `mark.svg` | **The mark on light backgrounds.** A rose stamp with a white L. |
| `mark-on-dark.svg` | **The mark on dark backgrounds.** A white paper stamp with a rose L. |
| `mark-small.svg`, `mark-small-on-dark.svg` | The same two, drawn with five perforations a side for sizes under 24px. The favicon is `mark-small.svg`. |
| `mark-mono.svg` | One colour (black), with the L cut out, for single-colour printing and stencils. |
| `icon.svg` | **The app icon.** The paper stamp on a navy tile, for phone home screens and avatars, which need a filled square. |
| `icon-maskable.svg` | Full-bleed navy square with the stamp in the 80% safe zone, for Android and PWA maskable icons. |
| `png/` | The app icon and both marks at 16–1024px. |
| `og-image.png` | 1200×630 social card for the website. |
| `social-preview.html` | Source for both social images. |

## Colours

| Name | Hex | Where |
| --- | --- | --- |
| Rose | `#c31d4c` | The stamp on light backgrounds, the L on dark ones, and the app's accent colour. |
| Rose edge | `#e2456f` | The strip under the paper stamp. |
| Rose deep | `#7d1231` | The strip under the rose stamp. |
| Navy | `#14213d` | The app icon's tile. |
| White | `#ffffff` | The paper stamp, and the L on the rose stamp. |

## Construction

- A 64×64 grid. The stamp face is 52×52 at (6, 4), so its edges land on whole pixels at 32px.
- Perforations are evenly spaced circles with one on every corner: seven gaps a side at radius 2.6, or five at radius 3.5 in the small drawing.
- The edge is the same stamp shape, 4 units lower, clipped so it only shows below the stamp.
- The L is 26 wide and 29.64 tall with a stroke of 11.7. It's centred on the stamp face, then nudged 1.04 right and 0.78 up, because an L's weight sits at its bottom-left.
- The L is printed, not cut out, so the edge never shows through it. Only the one-colour mark cuts it out.
- The app icon's tile has a corner radius of 15, with the stamp at 70% of its width.

## Using it

- **Pick the stamp by its background:** the rose stamp on light, the paper stamp on dark. In the web app, `LogoMark` follows the theme by itself.
- **Keep clear space** of at least a quarter of the mark's width on every side.
- **Minimum size:** 16px. Under 24px, use the small drawing.
- **Don't** recolour the stamp outside these versions, add outlines, stretch it, or put the rose stamp on a rose or busy background.
- **Wordmark:** "**Latest**Arr" in Newsreader, "Latest" bold and "Arr" regular, next to the mark. It's not drawn inside it.
