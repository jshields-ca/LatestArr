---
"@latestarr/server": minor
"@latestarr/web": minor
"@latestarr/db": minor
---

**Improved:** The old drag-and-drop template editor is gone, replaced by designs. Templates you built with it become code designs automatically. They send exactly as before, and you can now edit them in the code editor with a live preview. The web app is also much smaller: the drag-and-drop editor alone was a 2.3 MB download.

<details>
<summary>Technical details</summary>

Closes #199.

- Removed `grapesjs` and `grapesjs-mjml`, `apps/web/src/lib/grapesjs-*` and `pages/template-editor-page.tsx` (and their tests), and the `cdnjs.cloudflare.com` style and font CSP sources the editor's icon font needed. `/templates/:id/edit` redirects to `/designs/:id`.
- Migration `0007_retire_drag_and_drop` drops `templates.design_json` (the editor's own project state) and `templates.compiled_html` (never read). A template that was never saved from the editor has no markup and always sent with Default, so it becomes an options design with the default settings.
- `POST /templates` with only a name now creates an options design. `PATCH` changes `mode` only when it's given explicitly, so saving a code design's text and buttons can't turn it back into an options design.
- README, self-hosting guide, and CONTRIBUTING describe designs instead of drag-and-drop.

</details>
