---
"@latestarr/web": patch
---

**Fixed:** You can type a hex colour like `181818` in the design editor.

Each colour now has a box under its name for the hex value, as well as the swatch. Some systems' colour pickers, including Windows', have no hex field, so there was no way to enter an exact colour. Six digits, with or without the `#`, apply as you type. A short form like `#181` applies when you leave the box. Anything that isn't a colour is marked and ignored.

<details>
<summary>Technical details</summary>

`ColourField` gets a text input alongside `<input type="color">`, using `parseHexColour` from `lib/colour.ts`. The server still validates every colour with `hexColor` in the design schema. Fixes #395.

</details>
