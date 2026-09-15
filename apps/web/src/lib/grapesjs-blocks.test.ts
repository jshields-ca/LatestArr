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

  function fakeComponent(contentType: string) {
    const values: Record<string, unknown> = { contentType, sort: "added", count: 5 };
    return { get: (key: string) => values[key] };
  }

  it("wraps a poster <img> in a Handlebars {{#if posterUrl}} guard with alt text on the title", () => {
    const model = getModelDefinition();
    const html = (model.toHTML as (this: unknown) => string).call(fakeComponent("movie"));

    expect(html).toContain("{{#if posterUrl}}");
    expect(html).toContain('alt="{{title}} cover art"');
    expect(html).toContain("{{#mediaList contentType=\"movie\"");
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
