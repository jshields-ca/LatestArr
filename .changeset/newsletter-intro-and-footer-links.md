---
"@latestarr/server": patch
---

**Improved:** The default newsletter layout now opens with a short line under the title ("Here's what's new in the last 7 days.", using your newsletter's own lookback setting) and its footer now links to LatestArr's GitHub repo and to where you can report an issue.

<details>
<summary>Technical details</summary>

Both changes are in the default MJML template (`apps/server/src/render/newsletter-template.ts`), the layout a newsletter falls back to when no custom template is picked.

Intro line: `NewsletterRenderContext` and `MjmlRenderContext` (`apps/server/src/render/mjml-template.ts`) both gained an optional `lookbackDays?: number`, threaded from `newsletter.lookbackDays` (`packages/db/src/schema.ts`) through `renderNewsletterContent` in `apps/server/src/pipeline/run-newsletter.ts`'s call to `renderDefaultNewsletterHtml`, and bound as `{{lookbackDays}}` in the Handlebars data `renderMjmlTemplate` passes to `Handlebars.compile`. Guarded by `{{#if lookbackDays}}` so the line is simply omitted for a caller that doesn't pass it (e.g. existing tests). A custom, GrapesJS-authored template has no built-in use for this today, but can reference `{{lookbackDays}}` directly since it's now part of the general render context.

Footer links: two plain `<a>` tags added inside the existing footer `<mj-text>`, pointing at `https://github.com/jshields-ca/LatestArr` and `https://github.com/jshields-ca/LatestArr/issues`, styled inline to match the existing muted footer text (no external CSS, consistent with the rest of this template's email-safe conventions).

</details>
