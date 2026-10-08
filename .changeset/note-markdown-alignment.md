---
"@latestarr/server": minor
"@latestarr/web": minor
---

**New:** A design's **Intro** and **Footer note** support simple formatting and alignment.

- **Formatting:** **bold**, *italic*, ~~strikethrough~~, `[links](https://example.com)` (in the design's accent colour), and bulleted or numbered lists.
- **Alignment:** each note can be left, centre or right aligned.
- **What stays the same:** existing notes look as they did, and HTML typed into a note still shows as text. One thing to check: a `*` or `_` around words, or a line starting with `-` or `1.`, now formats.

<details>
<summary>Technical details</summary>

- Closes #290.
- New `render/notes.ts`, using [markdown-it](https://github.com/markdown-it/markdown-it) 15 (a new server dependency) from its `zero` preset.
  - Enabled: lists, newline (`breaks: true`), emphasis, strikethrough, link, escape, entity. `html: false`.
  - `validateLink` allows only `http`, `https` and `mailto`.
  - Paragraphs, lists and links get inline styles, since email clients ignore most stylesheets. Lists are `inline-block` so they follow the note's alignment.
  - A single paragraph renders unwrapped, so the existing snapshot is unchanged. The last block's bottom gap is dropped.
- `{{introText}}` and `{{footerNote}}` now render this Markdown in code-mode designs too, replacing #289's line-break helper. Links use `noteLinkColor`, the design's accent, which `designContentVariables` passes along.
- New settings `content.introAlign` and `content.footerAlign` (`left`, `center` or `right`; default `left`) become `mj-text align`.
- Editor: a `NoteField` with an alignment picker in design mode and a formatting hint.

</details>
