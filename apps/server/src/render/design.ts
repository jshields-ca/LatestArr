import { z } from "zod";
import { EMAIL_FONTS, type EmailFont } from "./email-fonts.js";

// A "design" is a set of options (colours, font, layout, what each item
// shows, how items are grouped) that the renderer turns into MJML. Unlike a
// hand-authored template it can't produce a broken email. The default
// settings' output is recorded in default-design.snapshot.test.ts, so any
// change to it is deliberate.

export const DESIGN_KINDS = ["movie", "tv_episode", "tv_season", "book", "audiobook", "game"] as const;
export type DesignKind = (typeof DESIGN_KINDS)[number];

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
      groupByType: z.boolean().default(true),
      // Several new episodes of one series share a row.
      groupEpisodes: z.boolean().default(true),
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
      // Where those buttons go: above or below the intro, or at the end.
      ctaPlacement: z.enum(["beforeIntro", "afterIntro", "end"]).default("afterIntro"),
      // "Watch on Plex"-style buttons for linked sources with a public URL:
      // near the top, under each section (grouped designs), or after the items.
      sourceButtons: z
        .object({
          enabled: z.boolean().default(true),
          placement: z.enum(["top", "sections", "end"]).default("end"),
        })
        .prefault({}),
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
  /** Behind the email's card. */
  page: string;
  accent: string;
  /** Keeps a badge visible when a client drops its background. */
  badgeBorder: string;
  accentTint: string;
  background: string;
  text: string;
  muted: string;
  subtle: string;
  border: string;
}

function paletteFor(settings: DesignSettings): Palette {
  // Lower-cased so the dark-mode rules below can match them in inline styles.
  const [accent, background, text, muted] = [
    settings.colors.accent,
    settings.colors.background,
    settings.colors.text,
    settings.colors.muted,
  ].map((colour) => colour.toLowerCase()) as [string, string, string, string];
  const defaults = DEFAULT_DESIGN_SETTINGS.colors;
  const neutralDefault = muted === defaults.muted && background === defaults.background;
  return {
    page: mix(background, accent, 0.045),
    accent,
    badgeBorder: mix(accent, background, 0.6),
    background,
    text,
    muted,
    accentTint: accent === defaults.accent && background === defaults.background ? DEFAULT_ACCENT_TINT : mix(accent, background, 0.85),
    subtle: neutralDefault ? DEFAULT_SUBTLE : mix(muted, background, 0.3),
    border: neutralDefault ? DEFAULT_BORDER : mix(muted, background, 0.8),
  };
}

function isLight(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
}

// The design's colours for dark mode, derived from its light ones.
function darkPaletteFor(p: Palette): Palette {
  const background = mix(p.text, "#000000", 0.35);
  const text = mix(p.background, p.text, 0.1);
  return {
    page: mix(background, "#000000", 0.45),
    background,
    text,
    accent: mix(p.accent, "#ffffff", 0.35),
    accentTint: mix(p.accent, background, 0.75),
    badgeBorder: mix(mix(p.accent, "#ffffff", 0.35), background, 0.5),
    muted: mix(p.muted, "#ffffff", 0.45),
    subtle: mix(p.subtle, "#ffffff", 0.3),
    border: mix(text, background, 0.85),
  };
}

// Email clients honour dark mode in different ways: Apple Mail and others
// apply prefers-color-scheme styles, Outlook.com marks the page with
// data-ogsc/data-ogsb, and some (Thunderbird's dark toggle, Gmail's apps)
// rewrite colours themselves when an email doesn't say it supports dark.
// This declares support and swaps each of the design's inline colours for
// its dark counterpart, matched by value, so no element needs its own
// class. A design that is already dark is left as it is.
function darkModeHead(p: Palette): string {
  const declare = `<mj-raw><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"></mj-raw>`;
  if (!isLight(p.background)) return `
    ${declare}`;
  const d = darkPaletteFor(p);
  // [selectors, declaration, whether it's a background (Outlook.com marks
  // those with data-ogsb, text colours with data-ogsc)]
  const rules: [string[], string, boolean][] = [
    [
      ["body", `[style*="background-color:${p.page}"]`, `[style*="background:${p.page}"]`],
      `background-color:${d.page} !important;`,
      true,
    ],
    [
      [`[style*="background-color:${p.background}"]`, `[style*="background:${p.background}"]`],
      `background-color:${d.background} !important;`,
      true,
    ],
    [[`[style*="color:${p.text}"]`], `color:${d.text} !important;`, false],
    [[`[style*="color:${p.muted}"]`], `color:${d.muted} !important;`, false],
    [[`[style*="color:${p.subtle}"]`], `color:${d.subtle} !important;`, false],
    [[`[style*="color:${p.accent}"]`], `color:${d.accent} !important;`, false],
    [[`[style*="background:${p.accentTint}"]`], `background:${d.accentTint} !important;`, true],
    [[`[style*="solid ${p.border}"]`], `border-color:${d.border} !important;`, false],
    [[`[style*="solid ${p.badgeBorder}"]`], `border-color:${d.badgeBorder} !important;`, false],
  ];
  const css = (outlook: boolean) =>
    rules
      .map(([selectors, declaration, isBackground]) => {
        const prefix = outlook ? (isBackground ? "[data-ogsb] " : "[data-ogsc] ") : "";
        return `${selectors.map((selector) => prefix + selector).join(", ")} { ${declaration} }`;
      })
      .join("\n      ");
  return `
    ${declare}
    <mj-style>
      :root { color-scheme: light dark; supported-color-schemes: light dark; }
      @media (prefers-color-scheme: dark) {
      ${css(false)}
      }
      ${css(true)}
    </mj-style>`;
}

// Inline SVG icons (Tabler's world / alert-circle outlines, MIT licensed)
// as data: URIs: static and tiny, so no per-send fetch. The stroke is a
// literal #hex: base64 content isn't URL-decoded, so %23 there would be an
// invalid colour and an invisible icon. Outlook
// doesn't show data: images, but the text label beside each carries the
// meaning anyway.
const WEBSITE_ICON_DATA_URI =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5Nzg0OTAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI5IiAvPjxwYXRoIGQ9Ik0zLjYgOWgxNi44IiAvPjxwYXRoIGQ9Ik0zLjYgMTVoMTYuOCIgLz48cGF0aCBkPSJNMTEuNSAzYTE3IDE3IDAgMCAwIDAgMTgiIC8+PHBhdGggZD0iTTEyLjUgM2ExNyAxNyAwIDAgMSAwIDE4IiAvPjwvc3ZnPg==";
const REPORT_ICON_DATA_URI =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5Nzg0OTAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI5IiAvPjxwYXRoIGQ9Ik0xMiA4djQiIC8+PHBhdGggZD0iTTEyIDE2aC4wMSIgLz48L3N2Zz4=";

// One item's markup for the chosen layout. Plain HTML, so it always sits
// inside an <mj-raw> (mjml silently drops bare HTML in a column). Every
// value interpolated here comes from validated settings (hex colours, a
// font from our own catalog), never free text.
function itemMarkup(settings: DesignSettings, p: Palette, font: string, withFallbackNote: boolean): string {
  const { show } = settings;
  const fallbackNote = withFallbackNote
    ? `{{#if isFallback}}<div style="font-size:12px;color:${p.subtle};margin-top:3px;">From the library</div>{{/if}}`
    : "";
  const pill = (text: string, extra = "") =>
    `<span style="display:inline-block;font-size:11px;font-weight:600;color:${p.accent};background:${p.accentTint};border:1px solid ${p.badgeBorder};border-radius:999px;padding:1px 8px;${extra}">${text}</span>`;
  // A grouped series says how many episodes it stands for instead of its type.
  const badge = show.badge
    ? `{{#if episodeCount}} ${pill("{{episodeCount}} new episodes", "vertical-align:middle;")}{{else}}{{#if contentLabel}} ${pill("{{contentLabel}}", "vertical-align:middle;")}{{/if}}{{/if}}`
    : "";
  const linkedTitle = `{{#if externalUrl}}<a href="{{externalUrl}}" style="color:inherit;text-decoration:none;">{{title}}</a>{{else}}{{title}}{{/if}}`;
  // Left out entirely for an item with none of these, rather than leaving
  // an empty line.
  const details = (markup: string) => `{{#if detailsLine}}${markup}{{/if}}`;
  const episodeList = (size: number) =>
    `{{#if episodes}}<div style="margin-top:4px;">{{#each episodes}}<div style="font-size:${size}px;color:${p.muted};margin-top:2px;">{{#if externalUrl}}<a href="{{externalUrl}}" style="color:inherit;text-decoration:none;">{{subtitle}}</a>{{else}}{{subtitle}}{{/if}}</div>{{/each}}{{#if moreEpisodes}}<div style="font-size:${size}px;color:${p.subtle};margin-top:2px;">and {{moreEpisodes}} more</div>{{/if}}</div>{{/if}}`;

  if (settings.layout === "compact") {
    return `<div style="padding:9px 0;border-top:1px solid ${p.border};font-family:${font};font-size:15px;color:${p.text};">` +
      `<span style="font-weight:700;">${linkedTitle}</span>${badge}` +
      (show.subtitle ? `{{#if subtitle}} <span style="color:${p.muted};font-size:14px;">· {{subtitle}}</span>{{/if}}` : "") +
      (show.details ? details(`<span style="color:${p.accent};font-size:13px;font-weight:600;"> {{detailsLine}}</span>`) : "") +
      (show.subtitle ? episodeList(13) : "") +
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
      (show.badge ? `<div style="margin-top:3px;">${badge.trim()}</div>` : "") +
      (show.subtitle ? `{{#if subtitle}}<div style="color:${p.muted};font-size:13px;margin-top:2px;">{{subtitle}}</div>{{/if}}` : "") +
      (show.details ? details(`<div style="font-size:12px;font-weight:600;color:${p.accent};margin-top:2px;">{{detailsLine}}</div>`) : "") +
      fallbackNote +
      `</div>`;
  }

  // "cards": a poster beside the details, one row per item, rows divided
  // by a hairline.
  const lines = [
    `        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${p.border};">`,
    `        <tr>`,
  ];
  if (show.poster) {
    lines.push(
      `        {{#if posterUrl}}<td width="72" style="vertical-align:top;padding:14px 14px 14px 0;">{{#if externalUrl}}<a href="{{externalUrl}}">{{/if}}<img src="{{posterUrl}}" width="72" alt="{{title}} cover art" style="display:block;width:72px;max-width:72px;border-radius:6px;" />{{#if externalUrl}}</a>{{/if}}</td>{{/if}}`,
    );
  }
  lines.push(`        <td style="vertical-align:top;padding:14px 0;font-family:${font};">`);
  lines.push(`          <div style="font-weight:700;font-size:16px;line-height:1.3;color:${p.text};">${linkedTitle}${badge}</div>`);
  if (show.subtitle) {
    lines.push(`          {{#if subtitle}}<div style="color:${p.muted};font-size:14px;margin-top:3px;">{{subtitle}}</div>{{/if}}`);
    lines.push(`          ${episodeList(14)}`);
  }
  if (show.details) {
    lines.push(details(`          <div style="font-size:13px;font-weight:600;color:${p.accent};margin-top:3px;">{{detailsLine}}</div>`));
  }
  if (show.overview) {
    lines.push(`          {{#if overviewShort}}<div style="font-size:14px;color:${p.text};margin-top:6px;line-height:1.45;">{{overviewShort}}</div>{{/if}}`);
  }
  if (show.dates) {
    lines.push(`          <div style="font-size:12px;color:${p.subtle};margin-top:6px;">Added {{addedAtFormatted}}{{#if releaseDateFormatted}} · Released {{releaseDateFormatted}}{{/if}}</div>`);
  }
  if (fallbackNote) lines.push(`          ${fallbackNote}`);
  lines.push(`        </td>`, `        </tr>`, `        </table>`);
  return lines.join("\n");
}

// Grid items are inline-blocks; font-size:0 on the wrapper removes the gap
// whitespace would otherwise leave between them.
function wrapItems(settings: DesignSettings, inner: string): string {
  return settings.layout === "grid" ? `<div style="font-size:0;">${inner}</div>` : inner;
}

// Items line up with the text above them (mj-text has 25px side padding).
// mjml places <mj-raw> content directly inside the column's <tbody>, so
// the wrapper has to be a table row: a <div> there gets moved out by the
// browser's HTML parser.
function wrapSectionItems(settings: DesignSettings, inner: string): string {
  return `<tr><td style="padding:0 25px;">${wrapItems(settings, inner)}</td></tr>`;
}

function heading(text: string, p: Palette, font: string): string {
  return `        <mj-text font-family="${font}" font-size="12px" font-weight="700" letter-spacing="1px" text-transform="uppercase" color="${p.accent}" padding-bottom="2px">${text}</mj-text>`;
}

// A button for the current {label, url}: filled in the accent for the
// design's own buttons, outlined for "Watch on Plex"-style source buttons.
function button(p: Palette, font: string, style: "primary" | "secondary"): string {
  const colors =
    style === "primary"
      ? `background-color="${p.accent}"\n          color="#ffffff"`
      : `background-color="${p.background}"\n          color="${p.accent}"\n          border="1px solid ${p.accent}"`;
  return `        <mj-button
          href="{{url}}"
          ${colors}
          font-family="${font}"
          font-size="14px"
          font-weight="600"
          border-radius="8px"
          inner-padding="${style === "primary" ? "10px 20px" : "9px 19px"}"
          align="left"
          padding-top="0"
          padding-bottom="8px"
        >{{label}}</mj-button>`;
}

function emptyMessage(p: Palette, font: string): string {
  return `        <mj-text font-family="${font}" font-size="14px" color="${p.muted}">Nothing new this time.</mj-text>`;
}

// Each section of a grouped newsletter: episodes and seasons share "TV".
const SECTIONS: { kinds: DesignKind[]; heading: string; browse: string }[] = [
  { kinds: ["movie"], heading: "Movies", browse: "movies" },
  { kinds: ["tv_episode", "tv_season"], heading: "TV", browse: "TV" },
  { kinds: ["book"], heading: "Books", browse: "books" },
  { kinds: ["audiobook"], heading: "Audiobooks", browse: "audiobooks" },
  { kinds: ["game"], heading: "Games", browse: "games" },
];

// Sections in the design's chosen order: each sits where its first kind is.
function orderedSections(order: DesignKind[]) {
  const rank = (kinds: DesignKind[]) => Math.min(...kinds.map((kind) => {
    const index = order.indexOf(kind);
    return index === -1 ? order.length : index;
  }));
  return [...SECTIONS].sort((a, b) => rank(a.kinds) - rank(b.kinds));
}

function ungroupedItems(settings: DesignSettings, p: Palette, font: string): string {
  const { limit, empty, groupEpisodes } = settings.sections;
  const card = itemMarkup(settings, p, font, false);
  const hash = [limit ? `count="${limit}"` : "", groupEpisodes ? `groupEpisodes="true"` : ""].filter(Boolean).join(" ");
  const open = hash ? `{{#mediaList ${hash}}}` : `{{#each items}}`;
  const close = hash ? `{{/mediaList}}` : `{{/each}}`;
  const list = [
    `    <mj-section padding="4px 0 12px">`,
    `      <mj-column>`,
    `        <mj-raw>`,
    `        ${wrapSectionItems(settings, `${open}\n${card}\n        ${close}`)}`,
    `        </mj-raw>`,
    `      </mj-column>`,
    `    </mj-section>`,
  ].join("\n");

  let whenEmpty: string;
  if (empty === "random") {
    const fallbackCard = itemMarkup(settings, p, font, true);
    whenEmpty = [
      `    <mj-section padding="4px 0 12px">`,
      `      <mj-column>`,
      `        <mj-text font-family="${font}" font-size="14px" color="${p.muted}">Nothing new this time. Here are a few from the library:</mj-text>`,
      `        <mj-raw>`,
      `        ${wrapSectionItems(settings, `{{#mediaList emptyFallback="random" fallbackCount="${limit ?? 5}"}}\n${fallbackCard}\n        {{/mediaList}}`)}`,
      `        </mj-raw>`,
      `      </mj-column>`,
      `    </mj-section>`,
    ].join("\n");
  } else if (empty === "hide") {
    whenEmpty = "";
  } else {
    whenEmpty = [
      `    <mj-section padding="4px 0 12px">`,
      `      <mj-column>`,
      emptyMessage(p, font),
      `      </mj-column>`,
      `    </mj-section>`,
    ].join("\n");
  }

  return whenEmpty
    ? `    {{#if items.length}}\n${list}\n    {{else}}\n${whenEmpty}\n    {{/if}}`
    : `    {{#if items.length}}\n${list}\n    {{/if}}`;
}

function groupedItems(settings: DesignSettings, p: Palette, font: string): string {
  const { limit, empty, order, groupEpisodes } = settings.sections;
  const { sourceButtons } = settings.content;
  const perSection = sourceButtons.enabled && sourceButtons.placement === "sections";
  const blocks =orderedSections(order).map((section) => {
    const contentType = section.kinds.join(",");
    const hash = [
      `contentType="${contentType}"`,
      limit ? `count="${limit}"` : "",
      groupEpisodes ? `groupEpisodes="true"` : "",
      empty === "link" ? `emptyFallback="link" fallbackWrap="none" fallbackLinkLabel="Browse ${section.browse}"` : "",
      empty === "random" ? `emptyFallback="random" fallbackCount="${limit ?? 5}"` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const card = itemMarkup(settings, p, font, empty === "random");
    const body = [
      `    <mj-section padding="8px 0 4px">`,
      `      <mj-column>`,
      heading(section.heading, p, font),
      `        <mj-raw>`,
      `        ${wrapSectionItems(settings, `{{#mediaList ${hash}}}\n${card}\n        {{/mediaList}}`)}`,
      `        </mj-raw>`,
      empty === "message" ? `        {{#ifAnyItems contentType="${contentType}"}}{{else}}\n${emptyMessage(p, font)}\n        {{/ifAnyItems}}` : "",
      perSection
        ? `        {{#sourceButtonsFor contentType="${contentType}"}}\n${button(p, font, "secondary")}\n        {{/sourceButtonsFor}}`
        : "",
      `      </mj-column>`,
      `    </mj-section>`,
    ]
      .filter(Boolean)
      .join("\n");
    // A section with nothing new is left out entirely when empty sections
    // are hidden; otherwise it only appears for content types this
    // newsletter's linked sources actually provide.
    return empty === "hide"
      ? `    {{#ifAnyItems contentType="${contentType}"}}\n${body}\n    {{/ifAnyItems}}`
      : `    {{#ifKindLinked contentType="${contentType}"}}\n${body}\n    {{/ifKindLinked}}`;
  });

  // With nothing new, and no section left to say so (they're hidden, or no
  // source is linked), one line says it for the whole issue.
  const message = `    <mj-section>\n      <mj-column>\n        <mj-text font-family="${font}" font-size="14px" color="${p.muted}">No new items in this period.</mj-text>\n      </mj-column>\n    </mj-section>`;
  const nothingAtAll =
    empty === "hide"
      ? `    {{#unless items.length}}\n${message}\n    {{/unless}}`
      : `    {{#unless items.length}}{{#unless hasLinkedSources}}\n${message}\n    {{/unless}}{{/unless}}`;
  return [...blocks, nothingAtAll].filter(Boolean).join("\n");
}

function mostWatchedSection(settings: DesignSettings, p: Palette, font: string): string {
  const { mostWatched } = settings.sections;
  if (!mostWatched.enabled) return "";
  const card = itemMarkup(settings, p, font, false);
  return [
    `    {{#ifAnyItems sort="mostWatched"}}`,
    `    <mj-section padding="8px 0 4px">`,
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

// The email is a card on a softly tinted page: an accent bar across the
// top, the name, date range, and counts, then the items, with the credits
// below the card.
// Stands in for the generated dark-mode styles in a design switched to
// code, so its markup doesn't open with ~25 lines of CSS. Expanded when
// the email is rendered (expandDarkModeMarker); deleting the line turns
// the dark-mode colours off.
export const DARK_MODE_MARKER = "<!-- latestarr:dark-mode (dark-mode colours for this design are added here when it's sent; delete this line to leave them out) -->";
const DARK_MODE_MARKER_PATTERN = /<!--\s*latestarr:dark-mode\b[^>]*-->/;

export function expandDarkModeMarker(mjml: string, settings: DesignSettings): string {
  return mjml.replace(DARK_MODE_MARKER_PATTERN, () => darkModeHead(paletteFor(settings)).trim());
}

export function buildDesignMjml(settings: DesignSettings, options: { darkModeMarker?: boolean } = {}): string {
  const p = paletteFor(settings);
  const font = EMAIL_FONTS[settings.font].stack;
  const css = sanitizeCss(settings.customCss).trim();
  const customCss = css ? `\n    <mj-style inline="inline">${css}</mj-style>` : "";
  const darkMode = options.darkModeMarker ? `\n    ${DARK_MODE_MARKER}` : darkModeHead(p);
  const head = `\n  <mj-head>${darkMode}${customCss}\n  </mj-head>`;

  // Without a lookback window (a code path only tests use) there's no date
  // range, so the counts stand alone.
  const summary = settings.showLookbackLine
    ? `
        <mj-text font-family="${font}" font-size="14px" color="${p.muted}" padding-top="0">{{#if periodFormatted}}{{periodFormatted}} · {{/if}}{{#if itemCount}}{{itemCount}} new{{else}}Nothing new{{/if}}</mj-text>
        {{#if kindCounts.length}}
        <mj-text font-family="${font}" padding-top="2px" line-height="26px">{{#each kindCounts}}<span style="display:inline-block;font-size:12px;font-weight:600;color:${p.muted};background:${p.page};border:1px solid ${p.border};border-radius:999px;padding:2px 10px;margin:0 4px 4px 0;">{{this}}</span>{{/each}}</mj-text>
        {{/if}}`
    : "";

  const items = settings.sections.groupByType ? groupedItems(settings, p, font) : ungroupedItems(settings, p, font);
  const mostWatched = mostWatchedSection(settings, p, font);

  const { ctaPlacement, sourceButtons } = settings.content;
  const ctas = `
    {{#if ctas.length}}
    <mj-section padding="0 0 8px">
      <mj-column>
        {{#each ctas}}
${button(p, font, "primary")}
        {{/each}}
      </mj-column>
    </mj-section>
    {{/if}}`;
  // Under each section needs sections; without them the buttons go after the items.
  const sourcePlacement = !sourceButtons.enabled
    ? null
    : sourceButtons.placement === "sections" && !settings.sections.groupByType
      ? "end"
      : sourceButtons.placement;
  const allSourceButtons = `
    {{#if sourceButtons.length}}
    <mj-section padding="4px 0 8px">
      <mj-column>
        {{#each sourceButtons}}
${button(p, font, "secondary")}
        {{/each}}
      </mj-column>
    </mj-section>
    {{/if}}`;
  const title = `
        <mj-text font-family="${font}" font-size="26px" line-height="1.25" font-weight="700" color="${p.text}">{{newsletterName}}</mj-text>${summary}`;
  const intro = `
        <mj-text font-family="${font}" font-size="15px" line-height="1.5" color="${p.text}" padding-top="8px">{{introText}}</mj-text>`;
  // Buttons above the intro sit between the heading and the intro, so the
  // intro gets a section of its own.
  const header =
    ctaPlacement === "beforeIntro"
      ? `
    <mj-section padding="8px 0 4px">
      <mj-column>${title}
      </mj-column>
    </mj-section>${ctas}
    {{#if introText}}
    <mj-section padding="0 0 4px">
      <mj-column>${intro}
      </mj-column>
    </mj-section>
    {{/if}}`
      : `
    <mj-section padding="8px 0 4px">
      <mj-column>${title}
        {{#if introText}}${intro}
        {{/if}}
      </mj-column>
    </mj-section>${ctaPlacement === "afterIntro" ? ctas : ""}`;

  return `
<mjml>${head}
  <mj-body background-color="${p.page}">
    <mj-section padding="12px 0"><mj-column><mj-spacer height="8px" /></mj-column></mj-section>
    <mj-wrapper background-color="${p.background}" border-top="4px solid ${p.accent}" border-radius="14px" padding="12px 0 16px">${header}${sourcePlacement === "top" ? allSourceButtons : ""}
${items}${mostWatched ? `\n${mostWatched}` : ""}${sourcePlacement === "end" ? allSourceButtons : ""}
    {{#if footerNote}}
    <mj-section padding="8px 0 0">
      <mj-column>
        <mj-text font-family="${font}" font-size="14px" line-height="1.5" color="${p.muted}">{{footerNote}}</mj-text>
      </mj-column>
    </mj-section>
    {{/if}}${ctaPlacement === "end" ? ctas.replace('padding="0 0 8px"', 'padding="12px 0 0"') : ""}
    </mj-wrapper>
    <mj-section padding="16px 0 28px">
      <mj-column>
        <mj-text font-family="${font}" font-size="12px" line-height="1.6" color="${p.subtle}" align="center">
          Sent by LatestArr on {{generatedAtFormatted}}<br />
          <a href="https://www.latestarr.app" style="color:${p.subtle};text-decoration:none;" target="_blank" rel="noopener"><img src="${WEBSITE_ICON_DATA_URI}" width="13" height="13" alt="" style="vertical-align:middle;margin-right:4px;" />LatestArr.app</a>
          &nbsp;·&nbsp;
          <a href="https://github.com/jshields-ca/LatestArr/issues" style="color:${p.subtle};text-decoration:none;" target="_blank" rel="noopener"><img src="${REPORT_ICON_DATA_URI}" width="13" height="13" alt="" style="vertical-align:middle;margin-right:4px;" />Report an issue</a>
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`;
}
