---
"@latestarr/server": minor
"@latestarr/web": minor
"@latestarr/db": minor
---

**Improved:** A newsletter's intro, footer note, buttons, and font are now part of its design, set in the design editor where the live preview shows them. The newsletter's settings keep to what goes out, when, and to whom. When you upgrade, each newsletter's existing text, buttons, and font move into a design automatically, so every email looks exactly as before. A newsletter on Default with any of those set gets its own copy of Default, named after it.

<details>
<summary>Technical details</summary>

Closes #207 (part of #199).

- Design settings gain `content: { intro, footerNote, ctas }` (up to 4 buttons, http(s) links only). The pipeline passes them to every template as `{{introText}}`, `{{footerNote}}`, and `{{#each ctas}}`, so code templates keep working. The Default design no longer takes a per-newsletter font.
- `render/migrate-content-into-designs.ts` runs once at startup (flagged by the `migration.contentIntoDesigns` settings key). Newsletters sharing a design with different text get a copy each; newsletters with no text keep the original. The old `newsletters` columns stay unused for one release so you can roll back.
- The newsletter API no longer accepts `emailFont`, `introText`, `footerNote`, or `ctas`. The design editor gets a "Text and buttons" section; Save waits until every button is complete, and half-finished buttons are left out of the preview.

</details>
