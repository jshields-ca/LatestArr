import type { Block, Component, Editor } from "grapesjs";

// The Media List block is the one genuinely dynamic block in the library:
// a non-technical user configures it entirely through its three Traits
// (no HTML/CSS knowledge needed), and its export is a Handlebars block
// helper invocation — {{#mediaList contentType="..." sort="..." count=N}}
// — that the server's render pipeline (apps/server/src/render/mjml-template.ts)
// resolves against real item data at send time. The canvas only ever shows
// a friendly static summary of the current trait values; it never tries to
// preview real data inline.
const MEDIA_LIST_COMPONENT_TYPE = "media-list";

const CONTENT_TYPE_OPTIONS = [
  { id: "movie", label: "Movies" },
  { id: "tv_episode", label: "TV episodes" },
  { id: "tv_season", label: "TV seasons" },
  { id: "book", label: "Books" },
  { id: "audiobook", label: "Audiobooks" },
  { id: "game", label: "Games" },
];

// The accent color of LatestArr's own Bloom palette (hsl(343 74% 44%)),
// hardcoded here rather than imported from the Tailwind theme because this
// HTML ends up in a sent email, entirely outside the app's own CSS.
const ACCENT_COLOR = "#c31d4c";

// One Handlebars conditional per content type's most relevant secondary
// metadata line — movies/TV get runtime, books get a page count, audiobooks
// get a spoken-word duration, games get a platform. Falls through to
// nothing rendered when a source didn't supply that field for an item.
function metaLineForContentType(contentType: string): string {
  switch (contentType) {
    case "movie":
    case "tv_episode":
    case "tv_season":
      return `{{#if runtimeFormatted}}{{runtimeFormatted}}{{/if}}`;
    case "book":
      return `{{#if pageCount}}{{pageCount}} pages{{/if}}`;
    case "audiobook":
      return `{{#if durationFormatted}}{{durationFormatted}}{{/if}}`;
    case "game":
      return `{{#if platform}}{{platform}}{{/if}}`;
    default:
      return "";
  }
}

const SORT_OPTIONS = [
  { id: "added", label: "Latest added" },
  { id: "mostWatched", label: "Most watched" },
];

function contentTypeLabel(id: string): string {
  return CONTENT_TYPE_OPTIONS.find((option) => option.id === id)?.label ?? id;
}

function sortLabel(id: string): string {
  return SORT_OPTIONS.find((option) => option.id === id)?.label ?? id;
}

function registerMediaListType(editor: Editor): void {
  editor.Components.addType(MEDIA_LIST_COMPONENT_TYPE, {
    model: {
      defaults: {
        tagName: "mj-raw",
        draggable: true,
        droppable: false,
        editable: false,
        removable: true,
        copyable: true,
        contentType: "movie",
        sort: "added",
        count: 5,
        traits: [
          {
            type: "select",
            name: "contentType",
            label: "Content type",
            changeProp: true,
            options: CONTENT_TYPE_OPTIONS,
          },
          {
            type: "select",
            name: "sort",
            label: "Sort",
            changeProp: true,
            options: SORT_OPTIONS,
          },
          {
            type: "number",
            name: "count",
            label: "Number of items",
            changeProp: true,
            min: 1,
            max: 20,
          },
        ],
      },

      init() {
        this.on("change:contentType change:sort change:count", () => this.updatePreview());
        this.updatePreview();
      },

      updatePreview() {
        const contentType = this.get("contentType");
        const sort = this.get("sort");
        const count = this.get("count");
        this.components(
          `<div style="padding:12px;border:1px dashed #94a3b8;border-radius:6px;font-family:sans-serif;font-size:13px;color:#475569;">` +
            `<strong>Media List</strong><br/>` +
            `${count} ${contentTypeLabel(contentType)}, sorted by ${sortLabel(sort)}` +
            `</div>`,
        );
        // GrapesJS parses the HTML string above into a real child
        // component (a generic "text" type, since it's just a <div> with
        // text) that's independently selectable/hoverable by default. Left
        // alone, clicking anywhere on the rendered preview card selects
        // that inner child instead of this media-list wrapper, so the
        // Settings panel shows only the child's generic Id/Title traits —
        // not this component's real Content type/Sort/Number of items
        // traits — until the user finds the toolbar's unlabeled "select
        // parent" button. Locking the injected child(ren) makes a click
        // bubble straight up to this wrapper, the only thing meant to be
        // selectable here. `locked` (not just selectable/hoverable) also
        // covers any further-nested elements inside the injected HTML.
        this.components().forEach((child: Component) => {
          child.set({ selectable: false, hoverable: false, editable: false, locked: true });
        });
      },

      toHTML() {
        const contentType = this.get("contentType");
        const sort = this.get("sort");
        const count = this.get("count");
        const metaLine = metaLineForContentType(contentType);
        // A table, not flex/grid, for the poster+text layout — the one
        // layout mechanism that renders consistently across Gmail,
        // Outlook, and the rest of the clients a sent newsletter has to
        // survive. alt text on the poster is mandatory, not optional,
        // since it's the only description a screen reader or "images
        // off" client gets for that item.
        //
        // The <table> itself is wrapped in <mj-raw>...</mj-raw> (one pair
        // per rendered item, since {{#mediaList}} repeats this whole
        // template body once per matching item) because this component's
        // parent in the exported MJML is always an <mj-column>, and
        // MJML's compiler only passes through element types it recognizes
        // as its own components there — a bare <table> isn't one, and got
        // *silently dropped* (not even a validation error under the
        // "soft" validationLevel apps/server/src/render/mjml-template.ts
        // uses), producing an empty section in the actually-sent email
        // despite this component's canvas preview looking correct.
        // <mj-raw> is MJML's own explicit escape hatch for exactly this:
        // arbitrary HTML that should pass into the output completely
        // unvalidated and unmodified.
        return (
          `{{#mediaList contentType="${contentType}" sort="${sort}" count="${count}"}}\n` +
          `<mj-raw>\n` +
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">\n` +
          `<tr>\n` +
          `{{#if posterUrl}}<td width="80" style="vertical-align:top;padding-right:12px;">` +
          `<img src="{{posterUrl}}" width="80" alt="{{title}} cover art" style="display:block;width:80px;max-width:80px;border-radius:6px;" />` +
          `</td>{{/if}}\n` +
          `<td style="vertical-align:top;font-family:sans-serif;">\n` +
          `  <div style="font-weight:600;font-size:16px;color:#0f172a;">{{title}}</div>\n` +
          `  {{#if subtitle}}<div style="color:#64748b;font-size:13px;">{{subtitle}}</div>{{/if}}\n` +
          `  <div style="font-size:12px;font-weight:600;color:${ACCENT_COLOR};margin-top:2px;">${metaLine}{{#if rating}} · {{rating}}{{/if}}</div>\n` +
          `  {{#if overview}}<div style="font-size:13px;color:#334155;margin-top:4px;">{{overview}}</div>{{/if}}\n` +
          `  <div style="font-size:11px;color:#94a3b8;margin-top:4px;">Added {{addedAtFormatted}}</div>\n` +
          `</td>\n` +
          `</tr>\n` +
          `</table>\n` +
          `</mj-raw>\n` +
          `{{/mediaList}}`
        );
      },
    },
  });
}

// GrapesJS's blocks are drag-only by default — a plain click on one does
// nothing, so a keyboard-only user has no way to add a block at all. This
// is the pattern GrapesJS's own docs recommend for a non-drag alternative:
// appending the block's content to the end of the canvas on click/Enter.
// Registered on every block, including the MJML plugin's own (patched in
// applyClickToAddFallback below), not just LatestArr's three custom ones.
function appendBlockToCanvas(block: Block, editor: Editor): void {
  editor.getWrapper()?.append(block.get("content") as string);
}

// The two category labels the block panel groups every block under —
// structural/decorative primitives that don't depend on a source's data
// versus blocks that pull real item data (the generic Media List and its
// six content-kind presets below).
const CATEGORY_LAYOUT = "Layout";
const CATEGORY_CONTENT = "Content";

export function registerCustomBlocks(editor: Editor): void {
  registerMediaListType(editor);

  const bm = editor.BlockManager;

  bm.add("newsletter-header", {
    label: "Header",
    category: CATEGORY_LAYOUT,
    content: `<mj-section><mj-column><mj-text font-size="24px" font-weight="600">{{newsletterName}}</mj-text></mj-column></mj-section>`,
    onClick: appendBlockToCanvas,
  });

  bm.add("newsletter-footer", {
    label: "Footer",
    category: CATEGORY_LAYOUT,
    content: `<mj-section><mj-column><mj-text font-size="12px" color="#999999">Generated by LatestArr on {{generatedAtFormatted}}</mj-text></mj-column></mj-section>`,
    onClick: appendBlockToCanvas,
  });

  // Standard newsletter-builder primitives this library was otherwise
  // missing entirely — a horizontal rule and vertical whitespace, mapping
  // straight onto MJML's own mj-divider/mj-spacer tags (already registered
  // as real component types by the grapesjs-mjml plugin regardless of its
  // own `blocks` panel allowlist), wrapped in the same mj-section/mj-column
  // shell every other block here uses.
  bm.add("newsletter-divider", {
    label: "Divider",
    category: CATEGORY_LAYOUT,
    content: `<mj-section><mj-column><mj-divider border-width="1px" border-color="#e2e8f0" /></mj-column></mj-section>`,
    onClick: appendBlockToCanvas,
  });

  bm.add("newsletter-spacer", {
    label: "Spacer",
    category: CATEGORY_LAYOUT,
    content: `<mj-section><mj-column><mj-spacer height="24px" /></mj-column></mj-section>`,
    onClick: appendBlockToCanvas,
  });

  bm.add("media-list-block", {
    label: "Media List",
    category: CATEGORY_CONTENT,
    content: `<mj-section><mj-column><mj-raw data-gjs-type="${MEDIA_LIST_COMPONENT_TYPE}"></mj-raw></mj-column></mj-section>`,
    onClick: appendBlockToCanvas,
  });

  // One preset per adapter content kind (packages/adapters/core's
  // NewItem["kind"], mirrored by CONTENT_TYPE_OPTIONS above) — each is just
  // the same media-list component type with its "Content type" trait
  // pre-set via a `data-gjs-content-type` attribute, not a second
  // implementation. GrapesJS's HTML parser lowercases attribute names (a
  // real browser DOMParser under text/html), so the hyphenated attribute
  // name here relies on the `convertDataGjsAttributesHyphens` parser option
  // (enabled in template-editor-page.tsx's grapesjs.init) to map
  // `data-gjs-content-type` back onto the component's camelCase
  // `contentType` prop.
  for (const { id, label } of CONTENT_TYPE_OPTIONS) {
    bm.add(`media-list-block-${id}`, {
      label,
      category: CATEGORY_CONTENT,
      content:
        `<mj-section><mj-column><mj-raw data-gjs-type="${MEDIA_LIST_COMPONENT_TYPE}" ` +
        `data-gjs-content-type="${id}"></mj-raw></mj-column></mj-section>`,
      onClick: appendBlockToCanvas,
    });
  }
}

// The MJML plugin registers its own blocks (mj-section, mj-text, etc.)
// without an onClick, so they're drag-only too. Must run after both the
// plugin and registerCustomBlocks have added their blocks.
export function applyClickToAddFallback(editor: Editor): void {
  for (const block of editor.BlockManager.getAll()) {
    if (!block.get("onClick")) {
      block.set("onClick", appendBlockToCanvas);
    }
  }
}
