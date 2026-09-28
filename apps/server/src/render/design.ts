import { z } from "zod";
import { EMAIL_FONTS, type EmailFont } from "./email-fonts.js";

// A "design" is a set of options (colours, font, layout, what each item
// shows, how items are grouped) that the renderer turns into MJML. Unlike a
// hand-authored template it can't produce a broken email, and the default
// settings reproduce the original built-in layout exactly (see
// default-design.snapshot.test.ts).

export const DESIGN_KINDS = ["movie", "tv_episode", "tv_season", "book", "audiobook", "game"] as const;
export type DesignKind = (typeof DESIGN_KINDS)[number];

const KIND_HEADINGS: Record<DesignKind, string> = {
  movie: "Movies",
  tv_episode: "TV episodes",
  tv_season: "TV seasons",
  book: "Books",
  audiobook: "Audiobooks",
  game: "Games",
};

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colours must be 6-digit hex values like #c31d4c");

// Every field has a default, so a design saved by an older version (or a
// partial one) still parses, and new options can be added later without a
// data migration. prefault (not default) so nested defaults are applied.
export const designSettingsSchema = z.object({
  font: z.enum(Object.keys(EMAIL_FONTS) as [EmailFont, ...EmailFont[]]).default("ubuntu"),
  colors: z
    .object({
      accent: hexColor.default("#c31d4c"),
      background: hexColor.default("#ffffff"),
      text: hexColor.default("#241521"),
      muted: hexColor.default("#7c5a68"),
    })
    .prefault({}),
  showLookbackLine: z.boolean().default(true),
  layout: z.enum(["cards", "compact", "grid"]).default("cards"),
  show: z
    .object({
      poster: z.boolean().default(true),
      badge: z.boolean().default(true),
      subtitle: z.boolean().default(true),
      details: z.boolean().default(true),
      overview: z.boolean().default(true),
      dates: z.boolean().default(true),
    })
    .prefault({}),
  sections: z
    .object({
      groupByType: z.boolean().default(false),
      order: z.array(z.enum(DESIGN_KINDS)).default([...DESIGN_KINDS]),
      limit: z.number().int().min(1).max(50).nullable().default(null),
      // What an empty section (or, ungrouped, an empty issue) shows: nothing,
      // a "nothing new" line, a link to browse the library (grouped only),
      // or a few random picks from the whole library.
      empty: z.enum(["hide", "message", "link", "random"]).default("message"),
      mostWatched: z
        .object({ enabled: z.boolean().default(false), count: z.number().int().min(1).max(20).default(5) })
        .prefault({}),
    })
    .prefault({}),
  // The words around the item list. Rendered through Handlebars variables
  // ({{introText}}, {{footerNote}}, {{#each ctas}}), so code-mode designs
  // use them too, and they are escaped like any other value.
  content: z
    .object({
      intro: z.string().trim().max(2000).default(""),
      footerNote: z.string().trim().max(2000).default(""),
      // A handful of quick links (Plex app, "browse the library"), not a
      // general-purpose link list.
      ctas: z
        .array(z.object({ label: z.string().trim().min(1).max(40), url: z.url({ protocol: /^https?$/ }) }))
        .max(4)
        .default([]),
    })
    .prefault({}),
  customCss: z.string().max(10_000).default(""),
});

export type DesignSettings = z.infer<typeof designSettingsSchema>;

export const DEFAULT_DESIGN_SETTINGS: DesignSettings = designSettingsSchema.parse({});

// Parses stored or submitted settings, falling back to the defaults for
// anything missing or invalid rather than failing a send over a bad value.
export function parseDesignSettings(value: unknown): DesignSettings {
  const result = designSettingsSchema.safeParse(value ?? {});
  return result.success ? result.data : DEFAULT_DESIGN_SETTINGS;
}

// A design's words, as the template variables every design (and code
// template) reads.
export function designContentVariables(settings: DesignSettings) {
  const { intro, footerNote, ctas } = settings.content;
  return { introText: intro || undefined, footerNote: footerNote || undefined, ctas };
}

// The original palette's hand-tuned tint, border, and "subtle" shades. A
// custom palette derives them by mixing instead.
const DEFAULT_SUBTLE = "#9c8290";
const DEFAULT_ACCENT_TINT = "#fbe4ea";
const DEFAULT_BORDER = "#e9dbe0";

function mix(a: string, b: string, amount: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(channel(a, i) * (1 - amount) + channel(b, i) * amount));
  return `#${out.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

interface Palette {
  accent: string;
  accentTint: string;
  background: string;
  text: string;
  muted: string;
  subtle: string;
  border: string;
}

function paletteFor(settings: DesignSettings): Palette {
  const { accent, background, text, muted } = settings.colors;
  const defaults = DEFAULT_DESIGN_SETTINGS.colors;
  const neutralDefault = muted === defaults.muted && background === defaults.background;
  return {
    accent,
    background,
    text,
    muted,
    accentTint: accent === defaults.accent && background === defaults.background ? DEFAULT_ACCENT_TINT : mix(accent, background, 0.85),
    subtle: neutralDefault ? DEFAULT_SUBTLE : mix(muted, background, 0.3),
    border: neutralDefault ? DEFAULT_BORDER : mix(muted, background, 0.8),
  };
}

// Inline SVG icons (Tabler's brand-github / alert-circle outlines, MIT
// licensed) as data: URIs: static and tiny, so no per-send fetch. Outlook
// doesn't show data: images, but the text label beside each carries the
// meaning anyway.
const GITHUB_ICON_DATA_URI =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiUyMzk3ODQ5MCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik05IDE5Yy00LjMgMS40IC00LjMgLTIuNSAtNiAtM20xMiA1di0zLjVjMCAtMSAuMSAtMS40IC0uNSAtMmMyLjggLS4zIDUuNSAtMS40IDUuNSAtNmE0LjYgNC42IDAgMCAwIC0xLjMgLTMuMmE0LjIgNC4yIDAgMCAwIC0uMSAtMy4ycy0xLjEgLS4zIC0zLjUgMS4zYTEyLjMgMTIuMyAwIDAgMCAtNi4yIDBjLTIuNCAtMS42IC0zLjUgLTEuMyAtMy41IC0xLjNhNC4yIDQuMiAwIDAgMCAtLjEgMy4yYTQuNiA0LjYgMCAwIDAgLTEuMyAzLjJjMCA0LjYgMi43IDUuNyA1LjUgNmMtLjYgLjYgLS42IDEuMiAtLjUgMnYzLjUiIC8+PC9zdmc+";
const REPORT_ICON_DATA_URI =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiUyMzk3ODQ5MCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjkiIC8+PHBhdGggZD0iTTEyIDh2NCIgLz48cGF0aCBkPSJNMTIgMTZoLjAxIiAvPjwvc3ZnPg==";

// One item's markup for the chosen layout. Plain HTML, so it always sits
// inside an <mj-raw> (mjml silently drops bare HTML in a column). Every
// value interpolated here comes from validated settings (hex colours, a
// font from our own catalog), never free text.
function itemMarkup(settings: DesignSettings, p: Palette, font: string, withFallbackNote: boolean): string {
  const { show } = settings;
  const fallbackNote = withFallbackNote
    ? `{{#if isFallback}}<div style="font-size:12px;color:${p.subtle};margin-top:3px;">From the library</div>{{/if}}`
    : "";
  const badge = show.badge
    ? `{{#if contentLabel}} <span style="display:inline-block;font-size:11px;font-weight:600;color:${p.accent};background:${p.accentTint};border-radius:4px;padding:2px 6px;vertical-align:middle;">{{contentLabel}}</span>{{/if}}`
    : "";
  const linkedTitle = `{{#if externalUrl}}<a href="{{externalUrl}}" style="color:inherit;text-decoration:none;">{{title}}</a>{{else}}{{title}}{{/if}}`;
  const details = `{{#if runtimeFormatted}}{{runtimeFormatted}}{{/if}}{{#if pageCount}}{{pageCount}} pages{{/if}}{{#if durationFormatted}}{{durationFormatted}}{{/if}}{{#if platform}}{{platform}}{{/if}}{{#if rating}} · {{rating}}{{/if}}`;

  if (settings.layout === "compact") {
    return `<div style="padding:8px 0;border-bottom:1px solid ${p.border};font-family:${font};font-size:15px;color:${p.text};">` +
      `<span style="font-weight:700;">${linkedTitle}</span>${badge}` +
      (show.subtitle ? `{{#if subtitle}} <span style="color:${p.muted};font-size:14px;">· {{subtitle}}</span>{{/if}}` : "") +
      (show.details ? `<span style="color:${p.accent};font-size:13px;font-weight:600;"> ${details}</span>` : "") +
      (show.dates ? `<div style="font-size:12px;color:${p.subtle};margin-top:2px;">Added {{addedAtFormatted}}</div>` : "") +
      fallbackNote +
      `</div>`;
  }

  if (settings.layout === "grid") {
    const poster = show.poster
      ? `{{#if posterUrl}}{{#if externalUrl}}<a href="{{externalUrl}}">{{/if}}<img src="{{posterUrl}}" width="140" alt="{{title}} cover art" style="display:block;width:100%;max-width:140px;border-radius:8px;margin-bottom:6px;" />{{#if externalUrl}}</a>{{/if}}{{/if}}`
      : "";
    return `<div style="display:inline-block;width:50%;vertical-align:top;box-sizing:border-box;padding:0 12px 18px 0;font-family:${font};">` +
      poster +
      `<div style="font-weight:700;font-size:15px;color:${p.text};">${linkedTitle}</div>` +
      (show.badge ? `{{#if contentLabel}}<div style="margin-top:3px;"><span style="display:inline-block;font-size:11px;font-weight:600;color:${p.accent};background:${p.accentTint};border-radius:4px;padding:2px 6px;">{{contentLabel}}</span></div>{{/if}}` : "") +
      (show.subtitle ? `{{#if subtitle}}<div style="color:${p.muted};font-size:13px;margin-top:2px;">{{subtitle}}</div>{{/if}}` : "") +
      (show.details ? `<div style="font-size:12px;font-weight:600;color:${p.accent};margin-top:2px;">${details}</div>` : "") +
      fallbackNote +
      `</div>`;
  }

  // "cards", the original layout. With every option on this must stay
  // byte-identical to the recorded default output.
  const lines = [`        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">`, `        <tr>`];
  if (show.poster) {
    lines.push(
      `        {{#if posterUrl}}<td width="88" style="vertical-align:top;padding-right:14px;">{{#if externalUrl}}<a href="{{externalUrl}}">{{/if}}<img src="{{posterUrl}}" width="88" alt="{{title}} cover art" style="display:block;width:88px;max-width:88px;border-radius:8px;" />{{#if externalUrl}}</a>{{/if}}</td>{{/if}}`,
    );
  }
  lines.push(`        <td style="vertical-align:top;font-family:${font};">`);
  lines.push(`          <div style="font-weight:700;font-size:18px;color:${p.text};">${linkedTitle}${badge}</div>`);
  if (show.subtitle) lines.push(`          {{#if subtitle}}<div style="color:${p.muted};font-size:14px;margin-top:2px;">{{subtitle}}</div>{{/if}}`);
  if (show.details) lines.push(`          <div style="font-size:13px;font-weight:600;color:${p.accent};margin-top:3px;">${details}</div>`);
  if (show.overview) lines.push(`          {{#if overview}}<div style="font-size:14px;color:${p.text};margin-top:5px;line-height:1.4;">{{overview}}</div>{{/if}}`);
  if (show.dates) lines.push(`          <div style="font-size:12px;color:${p.subtle};margin-top:5px;">Added {{addedAtFormatted}}{{#if releaseDateFormatted}} · Released {{releaseDateFormatted}}{{/if}}</div>`);
  if (fallbackNote) lines.push(`          ${fallbackNote}`);
  lines.push(`        </td>`, `        </tr>`, `        </table>`);
  return lines.join("\n");
}

// Grid items are inline-blocks; font-size:0 on the wrapper removes the gap
// whitespace would otherwise leave between them.
function wrapItems(settings: DesignSettings, inner: string): string {
  return settings.layout === "grid" ? `<div style="font-size:0;">${inner}</div>` : inner;
}

// Sections with a heading indent their items to line up with it (headings
// are mj-text, which has 25px side padding). mjml places <mj-raw> content
// directly inside the column's <tbody>, so the wrapper has to be a table
// row: a <div> there gets moved out by the browser's HTML parser. The
// original ungrouped list has no heading and stays flush, so the default
// design's output is unchanged.
function wrapSectionItems(settings: DesignSettings, inner: string): string {
  return `<tr><td style="padding:0 25px;">${wrapItems(settings, inner)}</td></tr>`;
}

// The original "cards" list sits flush with the column (the recorded
// Default output); the newer layouts line up with the title instead.
function wrapUngroupedItems(settings: DesignSettings, inner: string): string {
  return settings.layout === "cards" ? wrapItems(settings, inner) : wrapSectionItems(settings, inner);
}

function heading(text: string, p: Palette, font: string): string {
  return `        <mj-text font-family="${font}" font-size="20px" font-weight="700" color="${p.text}" padding-bottom="4px">${text}</mj-text>`;
}

function emptyMessage(p: Palette, font: string): string {
  return `        <mj-text font-family="${font}" font-size="14px" color="${p.muted}">Nothing new this time.</mj-text>`;
}

function ungroupedItems(settings: DesignSettings, p: Palette, font: string): string {
  const { limit, empty } = settings.sections;
  const card = itemMarkup(settings, p, font, false);
  const open = limit ? `{{#mediaList count="${limit}"}}` : `{{#each items}}`;
  const close = limit ? `{{/mediaList}}` : `{{/each}}`;
  const list = [
    `    <mj-section>`,
    `      <mj-column>`,
    `        <mj-raw>`,
    `        ${wrapUngroupedItems(settings, `${open}\n${card}\n        ${close}`)}`,
    `        </mj-raw>`,
    `      </mj-column>`,
    `    </mj-section>`,
  ].join("\n");

  let whenEmpty: string;
  if (empty === "random") {
    const fallbackCard = itemMarkup(settings, p, font, true);
    whenEmpty = [
      `    <mj-section>`,
      `      <mj-column>`,
      `        <mj-text font-family="${font}" font-size="14px" color="${p.muted}">Nothing new this time. Here are a few from the library:</mj-text>`,
      `        <mj-raw>`,
      `        ${wrapUngroupedItems(settings, `{{#mediaList emptyFallback="random" fallbackCount="${limit ?? 5}"}}\n${fallbackCard}\n        {{/mediaList}}`)}`,
      `        </mj-raw>`,
      `      </mj-column>`,
      `    </mj-section>`,
    ].join("\n");
  } else if (empty === "hide") {
    whenEmpty = "";
  } else {
    whenEmpty = [
      `    <mj-section>`,
      `      <mj-column>`,
      `        <mj-text font-family="${font}">No new items in this period.</mj-text>`,
      `      </mj-column>`,
      `    </mj-section>`,
    ].join("\n");
  }

  return whenEmpty
    ? `    {{#if items.length}}\n${list}\n    {{else}}\n${whenEmpty}\n    {{/if}}`
    : `    {{#if items.length}}\n${list}\n    {{/if}}`;
}

function groupedItems(settings: DesignSettings, p: Palette, font: string): string {
  const { limit, empty, order } = settings.sections;
  const blocks = order.map((kind) => {
    const hash = [
      `contentType="${kind}"`,
      limit ? `count="${limit}"` : "",
      empty === "link" ? `emptyFallback="link" fallbackWrap="none" fallbackLinkLabel="Browse ${KIND_HEADINGS[kind].toLowerCase()}"` : "",
      empty === "random" ? `emptyFallback="random" fallbackCount="${limit ?? 5}"` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const card = itemMarkup(settings, p, font, empty === "random");
    const body = [
      `    <mj-section>`,
      `      <mj-column>`,
      heading(KIND_HEADINGS[kind], p, font),
      `        <mj-raw>`,
      `        ${wrapSectionItems(settings, `{{#mediaList ${hash}}}\n${card}\n        {{/mediaList}}`)}`,
      `        </mj-raw>`,
      empty === "message" ? `        {{#ifAnyItems contentType="${kind}"}}{{else}}\n${emptyMessage(p, font)}\n        {{/ifAnyItems}}` : "",
      `      </mj-column>`,
      `    </mj-section>`,
    ]
      .filter(Boolean)
      .join("\n");
    // A section with nothing new is left out entirely when empty sections
    // are hidden; otherwise it only appears for content types this
    // newsletter's linked sources actually provide.
    return empty === "hide"
      ? `    {{#ifAnyItems contentType="${kind}"}}\n${body}\n    {{/ifAnyItems}}`
      : `    {{#ifKindLinked contentType="${kind}"}}\n${body}\n    {{/ifKindLinked}}`;
  });

  const nothingAtAll =
    empty === "hide"
      ? `    {{#unless items.length}}\n    <mj-section>\n      <mj-column>\n        <mj-text font-family="${font}">No new items in this period.</mj-text>\n      </mj-column>\n    </mj-section>\n    {{/unless}}`
      : "";
  return [...blocks, nothingAtAll].filter(Boolean).join("\n");
}

function mostWatchedSection(settings: DesignSettings, p: Palette, font: string): string {
  const { mostWatched } = settings.sections;
  if (!mostWatched.enabled) return "";
  const card = itemMarkup(settings, p, font, false);
  return [
    `    {{#ifAnyItems sort="mostWatched"}}`,
    `    <mj-section>`,
    `      <mj-column>`,
    heading("Most watched", p, font),
    `        <mj-raw>`,
    `        ${wrapSectionItems(settings, `{{#mediaList sort="mostWatched" count="${mostWatched.count}"}}\n${card}\n        {{/mediaList}}`)}`,
    `        </mj-raw>`,
    `      </mj-column>`,
    `    </mj-section>`,
    `    {{/ifAnyItems}}`,
  ].join("\n");
}

// Custom CSS goes into an <mj-style inline="inline"> block. "<" is removed
// so it can't close the tag early, and "{{" / "}}" so Handlebars doesn't
// treat any of it as template syntax. Valid CSS needs neither.
function sanitizeCss(css: string): string {
  return css.replace(/</g, "").replace(/\{\{|\}\}/g, "");
}

export function buildDesignMjml(settings: DesignSettings): string {
  const p = paletteFor(settings);
  const font = EMAIL_FONTS[settings.font].stack;
  const css = sanitizeCss(settings.customCss).trim();
  const head = css ? `\n  <mj-head>\n    <mj-style inline="inline">${css}</mj-style>\n  </mj-head>` : "";
  const bodyOpen = p.background.toLowerCase() === "#ffffff" ? `  <mj-body>` : `  <mj-body background-color="${p.background}">`;

  const lookback = settings.showLookbackLine
    ? `\n        {{#if lookbackDays}}\n        <mj-text font-family="${font}" font-size="15px" color="${p.muted}" padding-top="0">Here's what's new in the last {{lookbackDays}} days.</mj-text>\n        {{/if}}`
    : "";

  const items = settings.sections.groupByType ? groupedItems(settings, p, font) : ungroupedItems(settings, p, font);
  const mostWatched = mostWatchedSection(settings, p, font);

  return `
<mjml>${head}
${bodyOpen}
    <mj-section>
      <mj-column>
        <mj-text font-family="${font}" font-size="28px" font-weight="700" color="${p.text}">{{newsletterName}}</mj-text>${lookback}
        {{#if introText}}
        <mj-text font-family="${font}" font-size="15px" color="${p.text}" padding-top="12px">{{introText}}</mj-text>
        {{/if}}
      </mj-column>
    </mj-section>
    {{#if ctas.length}}
    <mj-section>
      <mj-column>
        {{#each ctas}}
        <mj-button
          href="{{url}}"
          background-color="${p.accent}"
          color="#ffffff"
          font-family="${font}"
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
${items}${mostWatched ? `\n${mostWatched}` : ""}
    {{#if footerNote}}
    <mj-section>
      <mj-column>
        <mj-text font-family="${font}" font-size="13px" color="${p.muted}">{{footerNote}}</mj-text>
      </mj-column>
    </mj-section>
    {{/if}}
    <mj-section>
      <mj-column>
        <mj-raw>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${p.border};padding-top:14px;">
        <tr>
        <td style="font-family:${font};font-size:13px;color:${p.subtle};">
          Generated by LatestArr on {{generatedAtFormatted}}
        </td>
        <td align="right" style="font-family:${font};font-size:13px;color:${p.subtle};white-space:nowrap;">
          <a href="https://github.com/jshields-ca/LatestArr" style="color:${p.subtle};text-decoration:none;" target="_blank" rel="noopener"><img src="${GITHUB_ICON_DATA_URI}" width="14" height="14" alt="" style="vertical-align:middle;margin-right:4px;" />GitHub</a>
          &nbsp;&nbsp;
          <a href="https://github.com/jshields-ca/LatestArr/issues" style="color:${p.subtle};text-decoration:none;" target="_blank" rel="noopener"><img src="${REPORT_ICON_DATA_URI}" width="14" height="14" alt="" style="vertical-align:middle;margin-right:4px;" />Report an issue</a>
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
