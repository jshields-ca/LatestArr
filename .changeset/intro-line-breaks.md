---
"@latestarr/server": patch
"@latestarr/web": patch
---

**Fixed:** Line breaks in a design's **Intro** and **Footer note** now show in the preview and in sent emails. Before, every line ran together into one paragraph. A blank line leaves a gap between paragraphs.

<details>
<summary>Technical details</summary>

- Fixes #289.
- New `textWithLineBreaks()` in `render/mjml-template.ts` escapes each line and joins them with `<br>`. One or more blank lines become a single `<br><br>`.
- `{{introText}}` and `{{footerNote}}` are now bound as a Handlebars `SafeString`, so code-mode designs get the line breaks too. The text is still escaped, so HTML typed into either box shows as text.
- The plain-text version keeps the breaks, since `<br>` converts to a newline.

</details>
