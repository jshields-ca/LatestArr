import type { NewItem } from "@latestarr/adapter-core";
import { DEFAULT_EMAIL_FONT, EMAIL_FONTS, isEmailFont } from "./email-fonts.js";
import { renderMjmlTemplate } from "./mjml-template.js";

// The "default layout" a newsletter falls back to when its Template dropdown
// has no custom template picked (or the picked template has no compiledMjml
// yet). This used to be a completely separate hand-rolled Handlebars/HTML
// template with no MJML compilation and no poster/metadata support — a
// second rendering pipeline duplicating everything mjml-template.ts already
// does properly. It's now just another MJML source rendered through the
// same renderMjmlTemplate() as a user-authored custom template, so both
// paths get responsive layout, MSO/Outlook conditionals, and poster +
// metadata cards for free. The header/footer sections mirror the markup
// GrapesJS's "Header"/"Footer" blocks export (apps/web/src/lib/grapesjs-blocks.ts)
// so a default-rendered email looks consistent with a GrapesJS-authored one,
// and the per-item card mirrors that file's Media List block toHTML() output.
// A plain {{#each items}} is used instead of the {{#mediaList}} block helper
// since there's no user-configurable content-type/sort/count filtering here
// — the default template just shows everything the pipeline already fetched,
// in the order given.
//
// The card content is plain HTML (a <table>/<img>/<div> layout), so per
// mjml-template.test.ts's CARD_MJML fixture it must live inside <mj-raw> —
// mjml2html silently strips raw non-mj-tag HTML that isn't wrapped in
// <mj-raw>.

// The accent + text colors below are LatestArr's own Bloom palette (light
// theme — this HTML ends up in a sent email, entirely outside the app's own
// CSS, so a dark background isn't an option): ACCENT_COLOR is the light-
// theme --primary (hsl(343 74% 44%)), unchanged from before. TEXT_COLOR/
// MUTED_COLOR/SUBTLE_COLOR are the theme's own warm rose-tinted neutrals
// (--foreground/--muted-foreground and a lighter step of it) in place of the
// generic cold slate grays (#0f172a/#64748b/#94a3b8/#999999) the template
// used previously — picked so a sent email reads as visibly "Bloom" rather
// than a generic gray template, per production feedback after reviewing a
// real test send.
const ACCENT_COLOR = "#c31d4c";
const ACCENT_TINT = "#fbe4ea";
const TEXT_COLOR = "#241521";
const MUTED_COLOR = "#7c5a68";
const SUBTLE_COLOR = "#9c8290";

// Inline SVG icons (Tabler's brand-github / alert-circle outlines, MIT
// licensed) as data: URIs rather than a hosted image or CID attachment —
// they're static and tiny, so there's no per-send image-fetch/embed cost,
// and no external request an email client has to (and often won't) allow.
// Outlook's Word-based renderer doesn't support data: URI images, but the
// text label next to each icon carries the meaning regardless — a missing
// icon there is a cosmetic no-op, not a broken link.
const GITHUB_ICON_DATA_URI =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiUyMzk3ODQ5MCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik05IDE5Yy00LjMgMS40IC00LjMgLTIuNSAtNiAtM20xMiA1di0zLjVjMCAtMSAuMSAtMS40IC0uNSAtMmMyLjggLS4zIDUuNSAtMS40IDUuNSAtNmE0LjYgNC42IDAgMCAwIC0xLjMgLTMuMmE0LjIgNC4yIDAgMCAwIC0uMSAtMy4ycy0xLjEgLS4zIC0zLjUgMS4zYTEyLjMgMTIuMyAwIDAgMCAtNi4yIDBjLTIuNCAtMS42IC0zLjUgLTEuMyAtMy41IC0xLjNhNC4yIDQuMiAwIDAgMCAtLjEgMy4yYTQuNiA0LjYgMCAwIDAgLTEuMyAzLjJjMCA0LjYgMi43IDUuNyA1LjUgNmMtLjYgLjYgLS42IDEuMiAtLjUgMnYzLjUiIC8+PC9zdmc+";
const REPORT_ICON_DATA_URI =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiUyMzk3ODQ5MCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjkiIC8+PHBhdGggZD0iTTEyIDh2NCIgLz48cGF0aCBkPSJNMTIgMTZoLjAxIiAvPjwvc3ZnPg==";

// A function rather than a static string, since the font stack is the one
// piece of this template that's chosen per-newsletter (see
// NewsletterRenderContext.emailFont below) rather than fixed — interpolated
// directly via JS template literal (not a Handlebars {{fontFamily}}
// binding) since it always comes from our own EMAIL_FONTS catalog, never
// from user-typed input, so there's nothing here that needs escaping.
function buildDefaultMjmlTemplate(fontFamily: string): string {
  return `
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text font-family="${fontFamily}" font-size="28px" font-weight="700" color="${TEXT_COLOR}">{{newsletterName}}</mj-text>
        {{#if lookbackDays}}
        <mj-text font-family="${fontFamily}" font-size="15px" color="${MUTED_COLOR}" padding-top="0">Here's what's new in the last {{lookbackDays}} days.</mj-text>
        {{/if}}
        {{#if introText}}
        <mj-text font-family="${fontFamily}" font-size="15px" color="${TEXT_COLOR}" padding-top="12px">{{introText}}</mj-text>
        {{/if}}
      </mj-column>
    </mj-section>
    {{#if ctas.length}}
    <mj-section>
      <mj-column>
        {{#each ctas}}
        <mj-button
          href="{{url}}"
          background-color="${ACCENT_COLOR}"
          color="#ffffff"
          font-family="${fontFamily}"
          font-size="14px"
          font-weight="600"
          border-radius="8px"
          inner-padding="10px 20px"
          width="auto"
          padding-top="0"
          padding-bottom="8px"
        >{{label}}</mj-button>
        {{/each}}
      </mj-column>
    </mj-section>
    {{/if}}
    {{#if items.length}}
    <mj-section>
      <mj-column>
        <mj-raw>
        {{#each items}}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>
        {{#if posterUrl}}<td width="88" style="vertical-align:top;padding-right:14px;">{{#if externalUrl}}<a href="{{externalUrl}}">{{/if}}<img src="{{posterUrl}}" width="88" alt="{{title}} cover art" style="display:block;width:88px;max-width:88px;border-radius:8px;" />{{#if externalUrl}}</a>{{/if}}</td>{{/if}}
        <td style="vertical-align:top;font-family:${fontFamily};">
          <div style="font-weight:700;font-size:18px;color:${TEXT_COLOR};">{{#if externalUrl}}<a href="{{externalUrl}}" style="color:inherit;text-decoration:none;">{{title}}</a>{{else}}{{title}}{{/if}}{{#if contentLabel}} <span style="display:inline-block;font-size:11px;font-weight:600;color:${ACCENT_COLOR};background:${ACCENT_TINT};border-radius:4px;padding:2px 6px;vertical-align:middle;">{{contentLabel}}</span>{{/if}}</div>
          {{#if subtitle}}<div style="color:${MUTED_COLOR};font-size:14px;margin-top:2px;">{{subtitle}}</div>{{/if}}
          <div style="font-size:13px;font-weight:600;color:${ACCENT_COLOR};margin-top:3px;">{{#if runtimeFormatted}}{{runtimeFormatted}}{{/if}}{{#if pageCount}}{{pageCount}} pages{{/if}}{{#if durationFormatted}}{{durationFormatted}}{{/if}}{{#if platform}}{{platform}}{{/if}}{{#if rating}} · {{rating}}{{/if}}</div>
          {{#if overview}}<div style="font-size:14px;color:${TEXT_COLOR};margin-top:5px;line-height:1.4;">{{overview}}</div>{{/if}}
          <div style="font-size:12px;color:${SUBTLE_COLOR};margin-top:5px;">Added {{addedAtFormatted}}{{#if releaseDateFormatted}} · Released {{releaseDateFormatted}}{{/if}}</div>
        </td>
        </tr>
        </table>
        {{/each}}
        </mj-raw>
      </mj-column>
    </mj-section>
    {{else}}
    <mj-section>
      <mj-column>
        <mj-text font-family="${fontFamily}">No new items in this period.</mj-text>
      </mj-column>
    </mj-section>
    {{/if}}
    {{#if footerNote}}
    <mj-section>
      <mj-column>
        <mj-text font-family="${fontFamily}" font-size="13px" color="${MUTED_COLOR}">{{footerNote}}</mj-text>
      </mj-column>
    </mj-section>
    {{/if}}
    <mj-section>
      <mj-column>
        <mj-raw>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e9dbe0;padding-top:14px;">
        <tr>
        <td style="font-family:${fontFamily};font-size:13px;color:${SUBTLE_COLOR};">
          Generated by LatestArr on {{generatedAtFormatted}}
        </td>
        <td align="right" style="font-family:${fontFamily};font-size:13px;color:${SUBTLE_COLOR};white-space:nowrap;">
          <a href="https://github.com/jshields-ca/LatestArr" style="color:${SUBTLE_COLOR};text-decoration:none;" target="_blank" rel="noopener"><img src="${GITHUB_ICON_DATA_URI}" width="14" height="14" alt="" style="vertical-align:middle;margin-right:4px;" />GitHub</a>
          &nbsp;&nbsp;
          <a href="https://github.com/jshields-ca/LatestArr/issues" style="color:${SUBTLE_COLOR};text-decoration:none;" target="_blank" rel="noopener"><img src="${REPORT_ICON_DATA_URI}" width="14" height="14" alt="" style="vertical-align:middle;margin-right:4px;" />Report an issue</a>
        </td>
        </tr>
        </table>
        </mj-raw>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`;
}

export interface NewsletterRenderContext {
  newsletterName: string;
  items: NewItem[];
  generatedAt: Date;
  /** The newsletter's configured lookback-window length in days, shown as
   * a plain-language "Here's what's new in the last N days" line under the
   * title. Optional so existing tests/callers that don't care about the
   * intro line don't have to pass it — omitting it just omits that line
   * (see the {{#if lookbackDays}} guard above). */
  lookbackDays?: number;
  /** Which of EMAIL_FONTS to render with, by key (e.g. "ubuntu") — plain
   * string rather than the narrower EmailFont type since this ultimately
   * comes from the newsletters table's emailFont column, a free-text
   * column with its own default, not something worth threading a cast
   * through at every caller. An unrecognized value (a stale DB row from
   * before this option existed, or a manually edited one) falls back to
   * DEFAULT_EMAIL_FONT rather than rendering with an undefined font stack. */
  emailFont?: string;
  /** Free-text shown near the top, above the item list. Ignored (like
   * emailFont) once the newsletter has a custom templateId — the caller
   * only passes this through for the default-template render path. */
  introText?: string;
  /** Free-text shown near the bottom, above "Generated by LatestArr". */
  footerNote?: string;
  /** Up to a handful of {label, url} call-to-action buttons, rendered
   * right below the title/intro. */
  ctas?: { label: string; url: string }[];
}

export function renderDefaultNewsletterHtml(context: NewsletterRenderContext): Promise<string> {
  const emailFont =
    context.emailFont && isEmailFont(context.emailFont) ? context.emailFont : DEFAULT_EMAIL_FONT;
  const fontFamily = EMAIL_FONTS[emailFont].stack;
  return renderMjmlTemplate(buildDefaultMjmlTemplate(fontFamily), {
    newsletterName: context.newsletterName,
    items: context.items,
    generatedAt: context.generatedAt,
    lookbackDays: context.lookbackDays,
    introText: context.introText,
    footerNote: context.footerNote,
    ctas: context.ctas,
  });
}
