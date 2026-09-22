---
"@latestarr/web": minor
"@latestarr/server": minor
"@latestarr/db": minor
---

**Improved:** The default newsletter template now looks more like LatestArr — bigger, more readable text, warmer Bloom-tinted colors instead of generic gray, a restyled footer with small GitHub/Report-an-issue icons — and each newsletter can now pick which font it sends with (Ubuntu, Arial, Georgia, or Verdana).

<details>
<summary>Technical details</summary>

Addresses production feedback after reviewing a real test send's raw .eml: font sizes felt too small for comfortable/accessible reading, the palette (`#0f172a`/`#64748b`/`#94a3b8`/`#999999`) read as generic rather than Bloom, and the footer was two bare text links.

- `apps/server/src/render/newsletter-template.ts`: bumped font sizes across the per-item card and header/footer (title 24→28px, item title 16→18px, subtitle 13→14px, overview 13→14px, meta lines 11-12→12-13px), replaced the generic slate palette with the app's own Bloom neutrals (`TEXT_COLOR`/`MUTED_COLOR`/`SUBTLE_COLOR`, derived from `--foreground`/`--muted-foreground`), added a soft tinted fill to the content-kind badge, and rebuilt the footer as a bordered row with small inline-SVG (data: URI) GitHub/report icons next to the existing links — `ACCENT_COLOR` itself was already exactly the app's `--primary`, unchanged.
- Added a small **Font** picker (`apps/server/src/render/email-fonts.ts`'s `EMAIL_FONTS` catalog: Ubuntu, Arial, Georgia, Verdana — curated web-safe stacks, not arbitrary font upload, which email clients don't support reliably) as a new `newsletters.email_font` column (`packages/db/src/schema.ts`, migration `0003_grey_stardust.sql`, default `"ubuntu"`), validated server-side via a zod enum in `apps/server/src/http/routes/newsletters.ts`, and exposed in the web UI as `EmailFontPicker` next to the existing Template picker in the Newsletters page's Content panel — hidden once a custom template is picked, since a GrapesJS-authored template defines its own fonts.
- Found along the way: MJML's `<mj-attributes>`/`<mj-all>` defaults aren't honored by the installed `mjml` version for `<mj-text>`'s `font-family` — worked around by setting `font-family` explicitly on every `<mj-text>` tag and in the raw per-item/footer markup instead of relying on template-wide defaults.
- Scoped to the default template only — the GrapesJS "Media List" block (`apps/web/src/lib/grapesjs-blocks.ts`) that a custom template can use keeps its existing appearance; restyling it was out of scope for this pass.

</details>
