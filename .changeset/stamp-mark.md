---
"@latestarr/web": minor
---

**Improved:** A clearer logo: the stamp no longer sits on a rose tile, so it fills its space and stays crisp in the header and the browser tab.

- The stamp is white paper in the dark theme and rose in the light theme, and switches with the theme.
- The browser tab icon is the rose stamp, drawn with fewer, larger perforations so it's clear at 16px.
- The phone home-screen icon is the paper stamp on a navy tile.

<details>
<summary>Technical details</summary>

First of the brand changes from the UI review (#332). `docs/assets/brand/generate.mjs` stays the single source: the stamp face is now 52×52 at (6, 4) on the 64 grid, with a second drawing of five perforations a side for sizes under 24px. It writes `mark.svg`, `mark-on-dark.svg`, `mark-small.svg`, `mark-small-on-dark.svg`, `mark-mono.svg`, `icon.svg` and `icon-maskable.svg`, the web app's favicon and icons, and `logo-geometry.ts`. `icon-dark.svg`, `icon-light.svg` and their PNGs are removed. `LogoMark` takes a `variant` (`auto`, `paper` or `rose`): `auto` draws both stamps and shows one by theme with `dark:` classes; name one where the background doesn't follow the theme. The manifest's `background_color` is the icon's navy, `#14213d`. The social preview images still show the old icon and follow with the colour changes.

</details>
