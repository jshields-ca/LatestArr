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

// The "All New (This Period)" composite block: a single drag-in that stacks
// every content kind's own Media List (each showing everything added within
// the newsletter's lookback window, i.e. the same pool a per-kind block with
// its "Show all items in the period" trait on already reads from) under a
// heading for that kind, so a user doesn't have to drag in and configure six
// separate blocks to get "all new media of every kind" — the literal ask in
// the feedback this block exists to address ("no options for 'all new'
// based on the lookback settings"). It's its own component type, not just a
// canned multi-block `content` string like Header/Footer, for the same
// reason media-list is: its real export (one {{#mediaList}} call per kind,
// each gated by an {{#ifAnyItems}} heading) is only meaningful at MJML
// export time, so the canvas needs its own friendly static summary instead
// — see registerAllNewType's updatePreview()/toHTML() below.
const ALL_NEW_COMPONENT_TYPE = "media-list-all-new";

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

// A small outlined badge next to the title for a kind MediaKind itself
// doesn't distinguish — "Ebook" vs "Comic", "Audiobook" vs "Podcast" (see
// NewItem.contentLabel and mjml-template.ts's RenderableItem). Mirrors the
// same badge markup newsletter-template.ts's default layout uses.
const CONTENT_LABEL_BADGE =
  `{{#if contentLabel}} <span style="display:inline-block;font-size:10px;font-weight:600;` +
  `color:${ACCENT_COLOR};border:1px solid ${ACCENT_COLOR};border-radius:4px;padding:1px 5px;` +
  `vertical-align:middle;">{{contentLabel}}</span>{{/if}}`;

// Marks a card substituted in by emptyFallback="random" as a suggestion
// rather than something newly added, so it doesn't read as a false claim
// that this was actually added during the period.
const ISFALLBACK_PREFIX = `{{#if isFallback}}<span style="color:${ACCENT_COLOR};font-weight:600;">Suggested — nothing new this period · </span>{{/if}}`;

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

// order="random" picks `count` random items from the matching pool instead
// of always the first `count` — a different axis from `sort` (which pool:
// added vs. most-watched), so it's its own trait rather than a third sort
// option.
const ORDER_OPTIONS = [
  { id: "sequential", label: "In order" },
  { id: "random", label: "Random" },
];

// What a block shows when nothing in its pool matches its filters for this
// send's period — e.g. a Games block with nothing added in the last 7
// days. "none" (the default, and the only behavior before this existed)
// renders nothing at all, matching every template saved before this trait
// existed.
const EMPTY_FALLBACK_OPTIONS = [
  { id: "none", label: "Show nothing" },
  { id: "random", label: "Random items instead" },
  { id: "link", label: "Link to browse the source" },
];

// Builds the {{#mediaList ...}} opening hash-argument tag, shared by the
// media-list component's own toHTML() and by the "All New" composite's
// toHTML() (one call per content kind, always with sort="added" and
// showAll="true" — see ALL_NEW_COMPONENT_TYPE's comment above) so the two
// don't drift on hash-argument syntax or quoting.
function mediaListOpenTag(props: {
  contentType: string;
  sort: string;
  count: number | string;
  order: string;
  showAll: boolean;
  emptyFallback: string;
  fallbackCount: number | string;
  fallbackLinkLabel: string;
}): string {
  // fallbackLinkLabel is the one piece of this that's free text (every
  // other trait is a bounded select/number) — JSON.stringify gives it a
  // properly quote-escaped Handlebars string literal instead of letting a
  // literal `"` in the label break the surrounding hash-argument syntax.
  const fallbackLinkLabelLiteral = JSON.stringify(props.fallbackLinkLabel || "Browse the library");
  return (
    `{{#mediaList contentType="${props.contentType}" sort="${props.sort}" count="${props.count}" ` +
    `order="${props.order}" showAll="${props.showAll ? "true" : "false"}" ` +
    `emptyFallback="${props.emptyFallback}" fallbackCount="${props.fallbackCount}" ` +
    `fallbackLinkLabel=${fallbackLinkLabelLiteral}}}\n`
  );
}

// Builds the per-item card body — the poster+text <table> a {{#mediaList}}
// call repeats once per matching item — parameterized only by contentType
// (which picks the one secondary metadata line via metaLineForContentType).
// Shared by the media-list component's toHTML() and the "All New" composite
// so the poster+text layout is written once, not re-typed per content kind.
function mediaListCardBody(contentType: string): string {
  const metaLine = metaLineForContentType(contentType);
  // A table, not flex/grid, for the poster+text layout — the one layout
  // mechanism that renders consistently across Gmail, Outlook, and the rest
  // of the clients a sent newsletter has to survive. alt text on the poster
  // is mandatory, not optional, since it's the only description a screen
  // reader or "images off" client gets for that item.
  //
  // The <table> itself is wrapped in <mj-raw>...</mj-raw> (one pair per
  // rendered item, since {{#mediaList}} repeats this whole template body
  // once per matching item) because this markup's parent in the exported
  // MJML is always an <mj-column>, and MJML's compiler only passes through
  // element types it recognizes as its own components there — a bare
  // <table> isn't one, and got *silently dropped* (not even a validation
  // error under the "soft" validationLevel apps/server/src/render/mjml-
  // template.ts uses), producing an empty section in the actually-sent
  // email despite the canvas preview looking correct. <mj-raw> is MJML's
  // own explicit escape hatch for exactly this: arbitrary HTML that should
  // pass into the output completely unvalidated and unmodified.
  return (
    `<mj-raw>\n` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">\n` +
    `<tr>\n` +
    `{{#if posterUrl}}<td width="80" style="vertical-align:top;padding-right:12px;">` +
    `<img src="{{posterUrl}}" width="80" alt="{{title}} cover art" style="display:block;width:80px;max-width:80px;border-radius:6px;" />` +
    `</td>{{/if}}\n` +
    `<td style="vertical-align:top;font-family:sans-serif;">\n` +
    `  <div style="font-weight:600;font-size:16px;color:#0f172a;">{{title}}${CONTENT_LABEL_BADGE}</div>\n` +
    `  {{#if subtitle}}<div style="color:#64748b;font-size:13px;">{{subtitle}}</div>{{/if}}\n` +
    `  <div style="font-size:12px;font-weight:600;color:${ACCENT_COLOR};margin-top:2px;">${metaLine}{{#if rating}} · {{rating}}{{/if}}</div>\n` +
    `  {{#if overview}}<div style="font-size:13px;color:#334155;margin-top:4px;">{{overview}}</div>{{/if}}\n` +
    `  <div style="font-size:11px;color:#94a3b8;margin-top:4px;">${ISFALLBACK_PREFIX}Added {{addedAtFormatted}}{{#if releaseDateFormatted}} · Released {{releaseDateFormatted}}{{/if}}</div>\n` +
    `</td>\n` +
    `</tr>\n` +
    `</table>\n` +
    `</mj-raw>\n`
  );
}

function contentTypeLabel(id: string): string {
  return CONTENT_TYPE_OPTIONS.find((option) => option.id === id)?.label ?? id;
}

function sortLabel(id: string): string {
  return SORT_OPTIONS.find((option) => option.id === id)?.label ?? id;
}

function emptyFallbackLabel(id: string): string {
  return EMPTY_FALLBACK_OPTIONS.find((option) => option.id === id)?.label ?? id;
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
        order: "sequential",
        showAll: false,
        emptyFallback: "none",
        fallbackCount: 5,
        fallbackLinkLabel: "Browse the library",
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
          {
            type: "checkbox",
            name: "showAll",
            label: "Show all items in the period (ignore the number above)",
            changeProp: true,
          },
          {
            type: "select",
            name: "order",
            label: "Order",
            changeProp: true,
            options: ORDER_OPTIONS,
          },
          {
            type: "select",
            name: "emptyFallback",
            label: "When nothing matches this period",
            changeProp: true,
            options: EMPTY_FALLBACK_OPTIONS,
          },
          {
            type: "number",
            name: "fallbackCount",
            label: "Random fallback: how many to show",
            changeProp: true,
            min: 1,
            max: 20,
          },
          {
            type: "text",
            name: "fallbackLinkLabel",
            label: "Link fallback: link text",
            changeProp: true,
          },
        ],
      },

      init() {
        this.on(
          "change:contentType change:sort change:count change:order change:showAll change:emptyFallback",
          () => this.updatePreview(),
        );
        this.updatePreview();
      },

      updatePreview() {
        const contentType = this.get("contentType");
        const sort = this.get("sort");
        const count = this.get("count");
        const order = this.get("order");
        const showAll = this.get("showAll");
        const emptyFallback = this.get("emptyFallback");

        const countSummary = showAll ? "All" : count;
        const orderSummary = order === "random" ? ", random order" : "";
        const fallbackSummary =
          emptyFallback && emptyFallback !== "none"
            ? ` · if empty: ${emptyFallbackLabel(emptyFallback).toLowerCase()}`
            : "";

        this.components(
          `<div style="padding:12px;border:1px dashed #94a3b8;border-radius:6px;font-family:sans-serif;font-size:13px;color:#475569;">` +
            `<strong>Media List</strong><br/>` +
            `${countSummary} ${contentTypeLabel(contentType)}, sorted by ${sortLabel(sort)}${orderSummary}${fallbackSummary}` +
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
        const order = this.get("order");
        const showAll = this.get("showAll");
        const emptyFallback = this.get("emptyFallback");
        const fallbackCount = this.get("fallbackCount");
        const fallbackLinkLabel = this.get("fallbackLinkLabel");

        return (
          mediaListOpenTag({
            contentType,
            sort,
            count,
            order,
            showAll: Boolean(showAll),
            emptyFallback,
            fallbackCount,
            fallbackLinkLabel,
          }) +
          mediaListCardBody(contentType) +
          `{{/mediaList}}`
        );
      },
    },
  });
}

// The heading placed above each content kind's cards in the "All New"
// composite block — plain sans-serif to match the card text below it
// rather than introducing a third font choice, and one step up from a card
// title (16px) so it reads as a section label rather than another item.
function allNewHeadingHTML(label: string): string {
  return `<mj-text font-size="18px" font-weight="600" color="#0f172a">${label}</mj-text>\n`;
}

function registerAllNewType(editor: Editor): void {
  editor.Components.addType(ALL_NEW_COMPONENT_TYPE, {
    model: {
      defaults: {
        tagName: "mj-raw",
        draggable: true,
        droppable: false,
        editable: false,
        removable: true,
        copyable: true,
        // No traits: unlike media-list, there's nothing to configure —
        // this block's entire point is "everything, every kind, this
        // period," matching the lookback-scoped `items` pool every
        // per-kind block already reads from. A user who wants to narrow
        // it drags in an individual content-kind preset instead.
        traits: [],
      },

      init() {
        this.updatePreview();
      },

      updatePreview() {
        const kindLabels = CONTENT_TYPE_OPTIONS.map((option) => option.label).join(", ");
        this.components(
          `<div style="padding:12px;border:1px dashed #94a3b8;border-radius:6px;font-family:sans-serif;font-size:13px;color:#475569;">` +
            `<strong>All New (This Period)</strong><br/>` +
            `${kindLabels} — everything added within the newsletter's lookback window, ` +
            `sorted by latest added, each kind under its own heading. ` +
            `A kind with nothing new this period is skipped entirely, heading included.` +
            `</div>`,
        );
        // Same click-to-select-the-wrapper-not-the-child fix as
        // media-list's updatePreview() — see its comment for the full
        // story of why this is needed.
        this.components().forEach((child: Component) => {
          child.set({ selectable: false, hoverable: false, editable: false, locked: true });
        });
      },

      toHTML() {
        // One heading + {{#mediaList}} pair per adapter content kind,
        // reusing mediaListOpenTag/mediaListCardBody so this composite's
        // card markup can never drift from the standalone Media List
        // block's. Always sort="added" (this block has no "most watched"
        // equivalent — that's a per-kind, not a "what's new" concept) and
        // showAll="true" (the already-shipped, tested mechanism a
        // per-kind block's "Show all items in the period" trait also
        // uses — see mjml-template.ts's mediaList helper) so nothing here
        // is capped to a count.
        //
        // The heading is wrapped in {{#ifAnyItems}} rather than always
        // rendered: {{#mediaList}} has no way to tell the surrounding
        // template "I rendered zero items" (it's a block helper whose
        // body only runs per matching item), so without this a kind with
        // nothing new this period would still show its heading above an
        // empty section — exactly the "sparse" look the feedback this
        // block addresses was trying to avoid by asking for "all new,"
        // not "every possible category, most of them empty."
        return CONTENT_TYPE_OPTIONS.map(({ id, label }) => {
          return (
            `{{#ifAnyItems contentType="${id}" sort="added"}}\n` +
            allNewHeadingHTML(label) +
            `{{/ifAnyItems}}\n` +
            mediaListOpenTag({
              contentType: id,
              sort: "added",
              count: 5,
              order: "sequential",
              showAll: true,
              emptyFallback: "none",
              fallbackCount: 5,
              fallbackLinkLabel: "Browse the library",
            }) +
            mediaListCardBody(id) +
            `{{/mediaList}}\n`
          );
        }).join("");
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
// versus blocks that pull real item data (the generic Media List, its six
// content-kind presets, and the "All New (This Period)" composite below).
const CATEGORY_LAYOUT = "Layout";
const CATEGORY_CONTENT = "Content";

export function registerCustomBlocks(editor: Editor): void {
  registerMediaListType(editor);
  registerAllNewType(editor);

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

  // The composite block addressing the actual piece of user feedback this
  // whole feature exists for: "no options for 'all new' based on the
  // lookback settings" — one drag-in that groups everything added this
  // period under a heading per content kind, instead of six separate
  // per-kind blocks each needing its "Show all items" trait turned on by
  // hand. See ALL_NEW_COMPONENT_TYPE's comment for why it's its own
  // component type rather than a second implementation.
  bm.add("media-list-all-new-block", {
    label: "All New (This Period)",
    category: CATEGORY_CONTENT,
    content: `<mj-section><mj-column><mj-raw data-gjs-type="${ALL_NEW_COMPONENT_TYPE}"></mj-raw></mj-column></mj-section>`,
    onClick: appendBlockToCanvas,
  });
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
