import { describe, expect, it, vi } from "vitest";
import { applyClickToAddFallback, registerCustomBlocks } from "./grapesjs-blocks";

// A minimal fake of the slice of the GrapesJS Editor/Block API this module
// actually uses — the real Editor requires a browser canvas/iframe (see
// template-editor-page.test.tsx's comment on why grapesjs itself is
// mocked rather than instantiated in tests).
function fakeEditor() {
  const blocks = new Map<string, Map<string, unknown>>();
  const append = vi.fn();

  const BlockManager = {
    add: (id: string, opts: Record<string, unknown>) => {
      blocks.set(id, new Map(Object.entries(opts)));
    },
    getAll: () =>
      Array.from(blocks.values()).map((props) => ({
        get: (key: string) => props.get(key),
        set: (key: string, value: unknown) => props.set(key, value),
      })),
  };

  const Components = { addType: vi.fn() };
  const getWrapper = () => ({ append });

  return { BlockManager, Components, getWrapper, append };
}

describe("the media-list component's toHTML card markup", () => {
  function getModelDefinition() {
    const editor = fakeEditor();
    registerCustomBlocks(editor as never);
    const [, definition] = editor.Components.addType.mock.calls[0] as [string, { model: Record<string, unknown> }];
    return definition.model;
  }

  function fakeComponent(contentType: string, overrides: Record<string, unknown> = {}) {
    const values: Record<string, unknown> = {
      contentType,
      sort: "added",
      count: 5,
      order: "sequential",
      showAll: false,
      emptyFallback: "none",
      fallbackCount: 5,
      fallbackLinkLabel: "Browse the library",
      ...overrides,
    };
    return { get: (key: string) => values[key] };
  }

  it("wraps a poster <img> in a Handlebars {{#if posterUrl}} guard with alt text on the title", () => {
    const model = getModelDefinition();
    const html = (model.toHTML as (this: unknown) => string).call(fakeComponent("movie"));

    expect(html).toContain("{{#if posterUrl}}");
    expect(html).toContain('alt="{{title}} cover art"');
    expect(html).toContain("{{#mediaList contentType=\"movie\"");
  });

  it("wraps its <table> markup in <mj-raw> so MJML's compiler passes it through instead of silently dropping it", () => {
    // Regression test: this component's parent in the exported MJML is
    // always an <mj-column>, which MJML's compiler only accepts its own
    // known component tags inside — a bare <table> isn't one, and got
    // silently stripped under "soft" validation (no thrown error, just an
    // empty rendered section), even though the canvas preview looked
    // correct. See the toHTML() comment above for the full story.
    const model = getModelDefinition();
    const html = (model.toHTML as (this: unknown) => string).call(fakeComponent("movie"));

    expect(html).toContain("<mj-raw>\n<table");
    expect(html).toContain("</table>\n</mj-raw>");
  });

  it("shows runtime for movies, page count for books, duration for audiobooks, and platform for games", () => {
    const model = getModelDefinition();
    const toHTML = model.toHTML as (this: unknown) => string;

    expect(toHTML.call(fakeComponent("movie"))).toContain("runtimeFormatted");
    expect(toHTML.call(fakeComponent("book"))).toContain("pageCount");
    expect(toHTML.call(fakeComponent("audiobook"))).toContain("durationFormatted");
    expect(toHTML.call(fakeComponent("game"))).toContain("platform");
  });

  it("offers all six adapter media kinds in the content-type trait", () => {
    const model = getModelDefinition();
    const traits = (model.defaults as { traits: { name: string; options?: { id: string }[] }[] }).traits;
    const contentTypeTrait = traits.find((t) => t.name === "contentType")!;

    expect(contentTypeTrait.options?.map((o) => o.id)).toEqual([
      "movie",
      "tv_episode",
      "tv_season",
      "book",
      "audiobook",
      "game",
    ]);
  });

  it("wraps a contentLabel badge in its own {{#if}} guard next to the title", () => {
    const model = getModelDefinition();
    const html = (model.toHTML as (this: unknown) => string).call(fakeComponent("book"));

    expect(html).toContain("{{#if contentLabel}}");
    expect(html).toContain("{{contentLabel}}");
  });

  it("shows a Suggested marker guarded by {{#if isFallback}} and a releaseDateFormatted guard", () => {
    const model = getModelDefinition();
    const html = (model.toHTML as (this: unknown) => string).call(fakeComponent("movie"));

    expect(html).toContain("{{#if isFallback}}");
    expect(html).toContain("Suggested");
    expect(html).toContain("{{#if releaseDateFormatted}}");
  });

  it("passes order, showAll, emptyFallback, fallbackCount, and fallbackLinkLabel through as hash args", () => {
    const model = getModelDefinition();
    const html = (model.toHTML as (this: unknown) => string).call(
      fakeComponent("game", {
        order: "random",
        showAll: true,
        emptyFallback: "random",
        fallbackCount: 3,
      }),
    );

    expect(html).toContain('order="random"');
    expect(html).toContain('showAll="true"');
    expect(html).toContain('emptyFallback="random"');
    expect(html).toContain('fallbackCount="3"');
    expect(html).toContain("fallbackLinkLabel=");
  });

  it("safely embeds a fallbackLinkLabel containing a double quote", () => {
    const model = getModelDefinition();
    const html = (model.toHTML as (this: unknown) => string).call(
      fakeComponent("game", { fallbackLinkLabel: 'Browse "RomM" now' }),
    );

    // JSON.stringify escapes the embedded quote, so the hash argument
    // stays a single well-formed Handlebars string literal.
    expect(html).toContain('fallbackLinkLabel="Browse \\"RomM\\" now"');
  });
});

describe("the media-list component's updatePreview", () => {
  function getModelDefinition() {
    const editor = fakeEditor();
    registerCustomBlocks(editor as never);
    const [, definition] = editor.Components.addType.mock.calls[0] as [string, { model: Record<string, unknown> }];
    return definition.model;
  }

  // A fake of the slice of the Component API updatePreview() actually
  // uses: `this.get(...)` for the current trait values and
  // `this.components(html?)` both to inject the preview HTML (called with
  // an argument) and to read back the resulting children (called with
  // none) — mirroring how GrapesJS's real Components collection is both
  // the setter and the getter for a component's children.
  function fakeMediaListComponent(overrides: Record<string, unknown> = {}) {
    const values: Record<string, unknown> = { contentType: "movie", sort: "added", count: 5, ...overrides };
    const children: { set: ReturnType<typeof vi.fn> }[] = [];
    let injectedHtml: string | undefined;

    return {
      get: (key: string) => values[key],
      components: (html?: string) => {
        if (html === undefined) {
          return { forEach: (fn: (child: { set: ReturnType<typeof vi.fn> }) => void) => children.forEach(fn) };
        }
        injectedHtml = html;
        children.length = 0;
        children.push({ set: vi.fn() });
        return undefined;
      },
      getInjectedHtml: () => injectedHtml,
      getChildren: () => children,
    };
  }

  it("injects the trait-summary HTML as this component's children", () => {
    const model = getModelDefinition();
    const component = fakeMediaListComponent();

    (model.updatePreview as (this: unknown) => void).call(component);

    expect(component.getInjectedHtml()).toContain("Media List");
    expect(component.getInjectedHtml()).toContain("5 Movies, sorted by Latest added");
  });

  it("summarizes showAll, random order, and an empty-fallback choice in the preview text", () => {
    const model = getModelDefinition();
    const component = fakeMediaListComponent({
      contentType: "game",
      order: "random",
      showAll: true,
      emptyFallback: "random",
    });

    (model.updatePreview as (this: unknown) => void).call(component);

    const html = component.getInjectedHtml()!;
    expect(html).toContain("All Games");
    expect(html).toContain("random order");
    expect(html).toContain("if empty: random items instead");
  });

  it("locks every injected child so a click selects the media-list wrapper, not the child", () => {
    const model = getModelDefinition();
    const component = fakeMediaListComponent();

    (model.updatePreview as (this: unknown) => void).call(component);

    const children = component.getChildren();
    expect(children).toHaveLength(1);
    expect(children[0].set).toHaveBeenCalledWith({
      selectable: false,
      hoverable: false,
      editable: false,
      locked: true,
    });
  });
});

describe("the all-new composite component", () => {
  function getModelDefinition() {
    const editor = fakeEditor();
    registerCustomBlocks(editor as never);
    // media-list registers first (registerMediaListType), so the composite
    // type — registered right after it in registerCustomBlocks — is the
    // second addType call.
    const [, definition] = editor.Components.addType.mock.calls[1] as [string, { model: Record<string, unknown> }];
    return definition.model;
  }

  it("emits one {{#ifAnyItems}}-gated heading + {{#mediaList}} pair per adapter content kind", () => {
    const model = getModelDefinition();
    const html = (model.toHTML as (this: unknown) => string).call({});

    const presets: [string, string][] = [
      ["movie", "Movies"],
      ["tv_episode", "TV episodes"],
      ["tv_season", "TV seasons"],
      ["book", "Books"],
      ["audiobook", "Audiobooks"],
      ["game", "Games"],
    ];

    for (const [contentType, label] of presets) {
      expect(html).toContain(`{{#ifAnyItems contentType="${contentType}" sort="added"}}`);
      expect(html).toContain(`{{/ifAnyItems}}`);
      expect(html).toContain(`>${label}</mj-text>`);
      expect(html).toContain(`{{#mediaList contentType="${contentType}" sort="added"`);
    }
  });

  it("always sorts by added and shows every matching item, regardless of count", () => {
    const model = getModelDefinition();
    const html = (model.toHTML as (this: unknown) => string).call({});

    // sort="mostWatched" never appears — "all new" has no most-watched
    // equivalent, it's every kind's own added-this-period pool.
    expect(html).not.toContain('sort="mostWatched"');
    expect(html).toContain('showAll="true"');
  });

  it("reuses the exact same poster+text card markup as the standalone Media List block", () => {
    const model = getModelDefinition();
    const html = (model.toHTML as (this: unknown) => string).call({});

    // One <mj-raw><table>...</table></mj-raw> card body per content kind —
    // the same shared mediaListCardBody() the standalone block's toHTML()
    // uses, not a re-typed copy.
    expect(html.match(/<mj-raw>\n<table/g)).toHaveLength(6);
    expect(html).toContain('alt="{{title}} cover art"');
    expect(html).toContain("{{#if posterUrl}}");
  });

  it("has no configurable traits — it always covers every content kind", () => {
    const model = getModelDefinition();
    const traits = (model.defaults as { traits: unknown[] }).traits;
    expect(traits).toEqual([]);
  });

  it("injects a friendly static summary listing every content kind and locks its child", () => {
    const model = getModelDefinition();
    const children: { set: ReturnType<typeof vi.fn> }[] = [];
    let injectedHtml: string | undefined;
    const component = {
      components: (html?: string) => {
        if (html === undefined) {
          return { forEach: (fn: (child: { set: ReturnType<typeof vi.fn> }) => void) => children.forEach(fn) };
        }
        injectedHtml = html;
        children.length = 0;
        children.push({ set: vi.fn() });
        return undefined;
      },
    };

    (model.updatePreview as (this: unknown) => void).call(component);

    expect(injectedHtml).toContain("All New (This Period)");
    expect(injectedHtml).toContain("Movies");
    expect(injectedHtml).toContain("Games");
    expect(children[0].set).toHaveBeenCalledWith({
      selectable: false,
      hoverable: false,
      editable: false,
      locked: true,
    });
  });
});

describe("registerCustomBlocks + applyClickToAddFallback", () => {
  it("gives every LatestArr block a click-to-add handler that appends its content", () => {
    const editor = fakeEditor();
    registerCustomBlocks(editor as never);

    const headerBlock = editor.BlockManager.getAll().find((b) => b.get("label") === "Header")!;
    const onClick = headerBlock.get("onClick") as (block: unknown, ed: unknown) => void;
    expect(onClick).toBeTypeOf("function");

    onClick(headerBlock, editor);
    expect(editor.append).toHaveBeenCalledWith(headerBlock.get("content"));
  });

  it("groups Header/Footer/Divider/Spacer under Layout and Media List + its presets under Content", () => {
    const editor = fakeEditor();
    registerCustomBlocks(editor as never);
    const blocks = editor.BlockManager.getAll();
    const categoryOf = (label: string) => blocks.find((b) => b.get("label") === label)!.get("category");

    expect(categoryOf("Header")).toBe("Layout");
    expect(categoryOf("Footer")).toBe("Layout");
    expect(categoryOf("Divider")).toBe("Layout");
    expect(categoryOf("Spacer")).toBe("Layout");

    expect(categoryOf("Media List")).toBe("Content");
    for (const label of ["Movies", "TV episodes", "TV seasons", "Books", "Audiobooks", "Games"]) {
      expect(categoryOf(label)).toBe("Content");
    }
    expect(categoryOf("All New (This Period)")).toBe("Content");
  });

  it("registers the All New (This Period) block as an instance of the all-new composite component type", () => {
    const editor = fakeEditor();
    registerCustomBlocks(editor as never);
    const block = editor.BlockManager.getAll().find((b) => b.get("label") === "All New (This Period)")!;

    expect(block.get("content")).toContain('data-gjs-type="media-list-all-new"');

    const onClick = block.get("onClick") as (block: unknown, ed: unknown) => void;
    onClick(block, editor);
    expect(editor.append).toHaveBeenCalledWith(block.get("content"));
  });

  it("adds a Divider and a Spacer block using MJML's own mj-divider/mj-spacer tags", () => {
    const editor = fakeEditor();
    registerCustomBlocks(editor as never);
    const blocks = editor.BlockManager.getAll();

    const divider = blocks.find((b) => b.get("label") === "Divider")!;
    expect(divider.get("content")).toContain("<mj-divider");

    const spacer = blocks.find((b) => b.get("label") === "Spacer")!;
    expect(spacer.get("content")).toContain("<mj-spacer");
  });

  it("adds one Media List preset block per adapter content kind, each pre-setting the content-type attribute", () => {
    const editor = fakeEditor();
    registerCustomBlocks(editor as never);
    const blocks = editor.BlockManager.getAll();

    const presets: [string, string][] = [
      ["Movies", "movie"],
      ["TV episodes", "tv_episode"],
      ["TV seasons", "tv_season"],
      ["Books", "book"],
      ["Audiobooks", "audiobook"],
      ["Games", "game"],
    ];

    for (const [label, contentType] of presets) {
      const block = blocks.find((b) => b.get("label") === label)!;
      expect(block).toBeDefined();
      const content = block.get("content") as string;
      expect(content).toContain('data-gjs-type="media-list"');
      expect(content).toContain(`data-gjs-content-type="${contentType}"`);
    }
  });

  it("gives every preset block a click-to-add handler too, consistent with the rest of the library", () => {
    const editor = fakeEditor();
    registerCustomBlocks(editor as never);

    const moviesBlock = editor.BlockManager.getAll().find((b) => b.get("label") === "Movies")!;
    const onClick = moviesBlock.get("onClick") as (block: unknown, ed: unknown) => void;
    expect(onClick).toBeTypeOf("function");

    onClick(moviesBlock, editor);
    expect(editor.append).toHaveBeenCalledWith(moviesBlock.get("content"));
  });

  it("patches a block that has no onClick (e.g. one registered by a plugin) without touching one that already has one", () => {
    const editor = fakeEditor();
    const customHandler = vi.fn();
    editor.BlockManager.add("plugin-block", { label: "Plugin block", content: "<mj-text>x</mj-text>" });
    editor.BlockManager.add("already-handled", {
      label: "Already handled",
      content: "<mj-text>y</mj-text>",
      onClick: customHandler,
    });

    applyClickToAddFallback(editor as never);

    const pluginBlock = editor.BlockManager.getAll().find((b) => b.get("label") === "Plugin block")!;
    expect(pluginBlock.get("onClick")).toBeTypeOf("function");

    const alreadyHandled = editor.BlockManager.getAll().find((b) => b.get("label") === "Already handled")!;
    expect(alreadyHandled.get("onClick")).toBe(customHandler);
  });
});
