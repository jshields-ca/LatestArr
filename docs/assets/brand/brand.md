# LatestArr brand assets

The LatestArr icon is a **postage stamp with an L, lifted off a rose tile**: "delivered to your inbox", without the stock envelope. It was chosen in [#269](https://github.com/jshields-ca/LatestArr/issues/269). The four exploration rounds are archived under the [`archive/icon-exploration`](https://github.com/jshields-ca/LatestArr/tree/archive/icon-exploration/docs/assets/icon-exploration) tag.

Everything here is generated. Change `generate.mjs`, then run:

```bash
node docs/assets/brand/generate.mjs
```

That rewrites the SVGs and PNGs in this folder, the web UI's favicon and app icons (`apps/web/public`), and the geometry the in-app logo draws from (`apps/web/src/components/logo-geometry.ts`).

The social images are rendered from `social-preview.html` in a headless browser, at 1280×640 (`../social-preview.png`, for GitHub and the README) and 1200×630 (`og-image.png`, for latestarr.app's Open Graph and Twitter cards). Pass `?w=&h=` to render other sizes.

## Files

| File | Use |
| --- | --- |
| `icon.svg` | **The icon.** White stamp and rose L on a deep rose tile. Favicon, app icon, avatars. |
| `icon-dark.svg` | White stamp on the dark tile, for dark surroundings where rose is too loud. |
| `icon-light.svg` | Rose stamp with a white L on a pale tile, for white pages. |
| `icon-maskable.svg` | Full-bleed square with the stamp in the 80% safe zone, for Android and PWA maskable icons. |
| `mark.svg` | The stamp alone (no tile), in rose, for light backgrounds. |
| `mark-on-dark.svg` | The stamp alone, in white, for dark backgrounds. |
| `mark-mono.svg` | One colour (black), with the L cut out, for single-colour printing and stencils. |
| `png/` | Each tile at 16–1024px. |
| `og-image.png` | 1200×630 social card for the website. |
| `social-preview.html` | Source for both social images. |

## Colours

| Name | Hex | Where |
| --- | --- | --- |
| Rose | `#c31d4c` | The tile, the L, and the app's accent colour. |
| Rose light | `#ef5d86` | The stamp's shadow on rose. |
| Ink | `#0e1425` | The dark tile and dark backgrounds. |
| Blush | `#fbf1f4` | The light tile. |
| White | `#ffffff` | The stamp. |

## Construction

- A 64×64 grid, with a corner radius of 18 on the tile.
- The stamp face is 40×40 at (12, 10), so its edges land on whole pixels at 32px.
- Perforations are circles of radius 2.4, evenly spaced with one on every corner.
- The shadow is the same stamp shape, 3 units lower, clipped so it only shows below the stamp.
- The L is 20 wide and 22.8 tall with a stroke of 9. It's centred on the stamp face, then nudged 0.8 right and 0.6 up, because an L's weight sits at its bottom-left.
- The L is printed, not cut out, so the shadow never shows through it. Only the one-colour mark cuts it out.

## Using it

- **Keep clear space** of at least a quarter of the icon's width on every side.
- **Minimum size:** 16px for the tile, and 20px for the bare mark.
- **Don't** recolour the stamp outside these versions, add effects or outlines, rotate it, stretch it, or put the bare rose mark on a busy or rose background (use the tile instead).
- **Wordmark:** "**Latest**Arr" in Newsreader, "Latest" bold and "Arr" regular, next to the icon. It's not drawn inside it.
