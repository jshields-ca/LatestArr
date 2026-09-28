---
"@latestarr/server": minor
"@latestarr/web": minor
"@latestarr/db": minor
---

**New:** Design how your newsletters look without drag-and-drop. The new **Designs** page (it replaces Templates) lets you pick colours, font, and layout (cards, compact list, or grid); choose which details each item shows; group items by type in your own order; decide what an empty section shows; add a "Most watched" section; and add custom CSS. A live preview updates as you change things, with sample content or any of your real newsletters. Existing newsletters look exactly as before: they use the Default design, which you can duplicate as a starting point.

**Fixed:** Buttons no longer need a separate "Save buttons" click. They now live in the design and save with everything else.

<details>
<summary>Technical details</summary>

Part of #199 (phases 1 and 2; phase 1's renderer shipped in #205) and closes #197.

- Web: `pages/designs-page.tsx` (list, with the built-in Default shown first; create from Default, duplicate, delete) and `pages/design-editor-page.tsx` (settings in collapsible sections, with a sticky preview that re-renders 400 ms after the last change through `POST /templates/preview`, ignoring stale responses; unsaved-changes indicator and leave warning; explicit Save). Nav item and route `/designs`; `/templates` redirects there.
- Newsletter Content panel: `DesignPicker` replaces the Template picker (Default and your designs, with Edit linking to the design editor), saving with an inline `SaveStatus` instead of a toast. The intro, footer note, buttons, and font moved into the design in #207.
- `lib/design.ts` mirrors the server's design settings shape and defaults (`withDesignDefaults` fills options missing from older saved designs).
- Server: the ungrouped compact and grid layouts line up with the title, like grouped sections; ungrouped cards stays flush so the Default design's recorded output is unchanged.

</details>
