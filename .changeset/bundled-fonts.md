---
"@latestarr/web": patch
"@latestarr/server": patch
---

**Improved:** LatestArr's fonts now ship inside the app, so opening it no longer fetches them from Google.

- Nothing about your visit goes to a font host, and the app looks the same on a server with no internet access.
- One exception: previewing an email design that uses the Ubuntu font still loads that font from Google, as the email itself does for the people who receive it. Choose Arial, Georgia or Verdana for a design that loads nothing.

<details>
<summary>Technical details</summary>

Audit finding 2 from the UI review (#332). `@fontsource-variable/plus-jakarta-sans`, `/newsreader` (its `opsz.css`) and `/jetbrains-mono` 5.3.0 (OFL-1.1) are imported in `main.tsx`, and `index.html` no longer links `fonts.googleapis.com`. `--font-brand` pins `"opsz" 72` through `--font-brand--font-variation-settings`, the display cut the Google link used to request. The Content-Security-Policy still allows `fonts.googleapis.com` and `fonts.gstatic.com`, because the design editor's preview is a `srcdoc` iframe that inherits the page's policy and MJML loads Ubuntu from there; the comment in `app.ts` now says so. Checked in the built app: no requests to another site on the dashboard, Email servers, Logs and Newsletters pages, and all three families load from the app.

</details>
