---
"@latestarr/server": minor
"@latestarr/web": minor
"@latestarr/db": minor
---

**New:** Design how your newsletters look without drag-and-drop. The new **Designs** page (it replaces Templates) lets you pick colours, font, and layout (cards, compact list, or grid); choose which details each item shows; group items by type in your own order; decide what an empty section shows; add a "Most watched" section; and add custom CSS. A live preview updates as you change things, with sample content or any of your real newsletters. Existing newsletters look exactly as before: they use the Default design, which you can duplicate as a starting point.

**Fixed:** A newsletter's intro, footer note, and buttons now all save the same way, each on its own with a small "Saved" confirmation. Buttons save by themselves once every row has a label and a full link, instead of needing a separate "Save buttons" click.

<details>
<summary>Technical details</summary>

Part of #199 (phases 1 and 2; phase 1's renderer shipped in #205) and closes #197.

- Web: `pages/designs-page.tsx` (list, with the built-in Default shown first; create from Default, duplicate, delete; older drag-and-drop templates listed separately and still editable in the old editor until the migration phase) and `pages/design-editor-page.tsx` (settings in collapsible sections, with a sticky preview that re-renders 400 ms after the last change through `POST /templates/preview`, ignoring stale responses; unsaved-changes indicator and leave warning; explicit Save). Nav item and route `/designs`; `/templates` redirects there.
- Newsletter Content panel: `DesignPicker` replaces the Template picker (Default, designs, and "(older template)" entries, with Edit linking to the right editor). The Font picker only shows for Default, since other designs carry their own font. Intro, footer, and buttons show for any design, not just Default. All Content-panel fields share one inline `SaveStatus` instead of a toast per change; CTA rows save 800 ms after the last edit, and only when every row is complete.
- `lib/design.ts` mirrors the server's design settings shape and defaults (`withDesignDefaults` fills options missing from older saved designs).
- Server: the ungrouped compact and grid layouts line up with the title, like grouped sections; ungrouped cards stays flush so the Default design's recorded output is unchanged.

</details>
