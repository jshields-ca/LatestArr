---
"@latestarr/web": patch
---

**Fixed:** In the design editor, changing **Background** seemed to change the text colour, and changing **Text** the background. The preview was following your browser's dark mode, and a design's dark version uses Text as the background and Background as the text. Previews now have a **Light / Dark** switch, start in Light, and remember your choice. A note under the colour pickers explains how dark mode is worked out. The newsletter preview has the same switch.

<details>
<summary>Technical details</summary>

- Fixes #285.
- An `srcdoc` iframe's `prefers-color-scheme` follows the viewer's browser, so a viewer in dark mode saw `darkPaletteFor()`'s output.
- New `withPreviewScheme()` (`lib/email-preview.ts`) rewrites the email's `prefers-color-scheme` queries to always-true or never-true, according to the chosen scheme. This also works for code-mode templates with their own dark-mode CSS.
- New `EmailPreviewFrame` and `PreviewSchemeToggle` (`components/email-preview-frame.tsx`), used by the design editor and the newsletter preview dialog.
- The choice is kept in `localStorage` (`latestarr:email-preview-scheme`); it falls back to Light when storage is blocked.
- The sent email is unchanged.

</details>
