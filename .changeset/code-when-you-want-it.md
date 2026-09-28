---
"@latestarr/server": minor
"@latestarr/web": minor
---

**New:** Designs can be edited as code. On any design, **Edit as code** switches it to hand-written MJML. You start from exactly the markup its options produce, so you never start from a blank page. The code editor highlights Handlebars tags, flags mistakes on the line where they happen before you save, and sits beside the same live preview. A **Variables and helpers** panel lists everything you can use. The intro, footer note, and buttons stay in **Text and buttons**, so they work the same in code designs.

<details>
<summary>Technical details</summary>

Closes #200 (part of #199).

- Editor: CodeMirror 6 (`components/code-editor.tsx`, loaded on demand in its own chunk), with HTML highlighting coloured from the app's theme tokens, Handlebars tags marked, and server-reported issues as lint diagnostics. `components/design-code-reference.tsx` documents the render context and the `mediaList`, `ifAnyItems`, and `ifKindLinked` helpers.
- Server: `render/code-template.ts` checks code before preview and save. A Handlebars syntax error, or markup MJML can't render at all, is an error (422, with `issues`), shown in plain words with its line. MJML's own validation messages are warnings, since sends still render best-effort HTML. MJML is validated with the `{{ }}` tags blanked out, so line numbers still match.
- `POST /templates/preview` accepts `mjml` alongside `settings`. `POST /templates/:id/convert-to-code` switches a design to code. `POST`/`PATCH /templates` take an explicit `mode`, and saving a code design with its `settings` no longer turns it back into an options design.
- Designs list: code designs sit with the others (marked "Code") and duplicate with their code. Templates still holding the old drag-and-drop editor's state stay in their own section until the next step of #199.
- The built-in design's buttons no longer set `width="auto"`, which MJML flags as invalid. The rendered email looks the same, since the button's table already shrinks to fit.

</details>
