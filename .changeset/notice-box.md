---
"@latestarr/server": minor
"@latestarr/web": minor
---

**New:** A design can carry a highlighted notice: a title and a short note, as **Info**, **Warning** or **Alert**. Good for "Maintenance on Saturday" or "Verify with the email you use for Plex".

- Add it under the design editor's **Text**: choose its type, write a title and some text (with the same formatting as the intro), and put it after the intro or before the footer note.
- Each type has its own colour, as a tinted box with a bar down the left and a small icon, in light and dark mode.
- **Code designs** get it as `{{notice.title}}`, `{{notice.body}}` and `{{notice.type}}`.

<details>
<summary>Technical details</summary>

Closes #402, in the style picked during review (N1). Design settings gain `content.notice` (`type`, `title` up to 100 characters, `body` up to 1,000, `placement`). The title is escaped and the text goes through `render/notes.ts` like the intro, so neither can add markup or unsafe links. The colours are fixed per type rather than taken from the palette, so a warning always reads as one, and each has a dark-mode pair in the design's dark-mode CSS. The icon is a coloured circle with "i", "!" or "×" drawn in HTML rather than an image, so there's nothing to host or fetch and it shows with images off; its glyph colour (`#fffffe`) is unique so dark mode can recolour it without touching button text. One notice per design for now.

</details>
