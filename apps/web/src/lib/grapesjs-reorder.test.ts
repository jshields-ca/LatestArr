import { describe, expect, it, vi } from "vitest";
import { registerReorderControls } from "./grapesjs-reorder";

// A minimal fake of the slice of the GrapesJS Editor/Component/Components
// API this module actually uses, following the same pattern as
// grapesjs-blocks.test.ts's fakeEditor (the real Editor needs a browser
// canvas/iframe).
// Backed by a real mutable array so a fakeComponent's `move` mock (see the
// "updates the boundary titles after a successful move" test) can actually
// reorder it, the way the real component.move(parent, { at }) would.
function fakeSiblings(models: unknown[]) {
  return {
    indexOf: (model: unknown) => models.indexOf(model),
    get length() {
      return models.length;
    },
    __models: models,
  };
}

// `toolbar` is a plain mutable property here (mirroring GrapesJS's real
// `get toolbar()`, which is sugar over `.get('toolbar')`), and `set` writes
// straight through it — so a component's toolbar always reflects the most
// recent `.set("toolbar", ...)` call, the same as the real Editor.
function fakeComponent(id: string, parent: unknown, toolbar: unknown[] = []) {
  const component = {
    id,
    toolbar,
    parent: () => parent,
    move: vi.fn(),
    set: vi.fn(),
  };
  component.set.mockImplementation((key: string, value: unknown) => {
    if (key === "toolbar") component.toolbar = value as unknown[];
  });
  return component;
}

function fakeEditor() {
  const commands = new Map<string, { run: (editor: unknown) => void }>();
  const selectedHandlers: ((component: unknown) => void)[] = [];
  let selected: unknown = null;

  return {
    Commands: {
      add: (name: string, def: { run: (editor: unknown) => void }) => commands.set(name, def),
    },
    on: (event: string, handler: (component: unknown) => void) => {
      if (event === "component:selected") selectedHandlers.push(handler);
    },
    getSelected: () => selected,
    select: (component: unknown) => {
      selected = component;
      for (const handler of selectedHandlers) handler(component);
    },
    getCommand: (name: string) => commands.get(name)!,
  };
}

function toolbarIds(toolbar: { id: string }[]) {
  return toolbar.map((item) => item.id);
}

function titleOf(toolbar: { id: string; attributes: { title: string } }[], id: string) {
  return toolbar.find((item) => item.id === id)?.attributes.title;
}

describe("registerReorderControls", () => {
  it("adds Move up/down buttons to a selected component's toolbar exactly once", () => {
    const editor = fakeEditor();
    registerReorderControls(editor as never);

    const a = fakeComponent("a", null);
    editor.select(a);

    expect(a.set).toHaveBeenCalledTimes(1);
    expect(toolbarIds(a.toolbar as never)).toEqual(["latestarr-move-up", "latestarr-move-down"]);

    // Re-selecting a component whose toolbar already carries the buttons
    // must not append a second pair.
    editor.select(a);
    expect(a.set).toHaveBeenCalledTimes(1);
  });

  it("renders Move up/down as SVG icons, not the old bare unicode arrow characters", () => {
    const editor = fakeEditor();
    registerReorderControls(editor as never);

    const a = fakeComponent("a", null);
    editor.select(a);

    for (const item of a.toolbar as { label: string }[]) {
      expect(item.label).toContain("<svg");
      expect(item.label).not.toContain("&uarr;");
      expect(item.label).not.toContain("&darr;");
    }
  });

  it("moves the selected component one position earlier via component.move, not collection.add", () => {
    const editor = fakeEditor();
    registerReorderControls(editor as never);

    const first = fakeComponent("first", null);
    const second = fakeComponent("second", null);
    const siblings = fakeSiblings([first, second]);
    const parent = { components: () => siblings };
    second.parent = () => parent;

    editor.select(second);
    editor.getCommand("latestarr-move-up").run(editor);

    // Backbone's Collection.add() silently no-ops for a model already in
    // the collection, so the real GrapesJS reorder API is component.move()
    // — asserting it was called (with the destination and target index)
    // is what would have caught the original bug.
    expect(second.move).toHaveBeenCalledWith(parent, { at: 0 });
  });

  it("does nothing when moving up past the first position or down past the last", () => {
    const editor = fakeEditor();
    registerReorderControls(editor as never);

    const only = fakeComponent("only", null);
    const siblings = fakeSiblings([only]);
    const parent = { components: () => siblings };
    only.parent = () => parent;

    editor.select(only);
    editor.getCommand("latestarr-move-up").run(editor);
    editor.getCommand("latestarr-move-down").run(editor);

    expect(only.move).not.toHaveBeenCalled();
  });

  it("does nothing when nothing is selected", () => {
    const editor = fakeEditor();
    registerReorderControls(editor as never);

    expect(() => editor.getCommand("latestarr-move-up").run(editor)).not.toThrow();
  });

  it("marks Move up as already-at-the-top when the first item in a list is selected, and vice versa for the last", () => {
    const editor = fakeEditor();
    registerReorderControls(editor as never);

    const first = fakeComponent("first", null);
    const second = fakeComponent("second", null);
    const siblings = fakeSiblings([first, second]);
    const parent = { components: () => siblings };
    first.parent = () => parent;
    second.parent = () => parent;

    editor.select(first);
    expect(titleOf(first.toolbar as never, "latestarr-move-up")).toBe("Already at the top");
    expect(titleOf(first.toolbar as never, "latestarr-move-down")).toBe("Move down");

    editor.select(second);
    expect(titleOf(second.toolbar as never, "latestarr-move-up")).toBe("Move up");
    expect(titleOf(second.toolbar as never, "latestarr-move-down")).toBe("Already at the bottom");
  });

  it("silently no-ops a move past the boundary rather than throwing, matching the disabled-in-spirit button", () => {
    const editor = fakeEditor();
    registerReorderControls(editor as never);

    const first = fakeComponent("first", null);
    const second = fakeComponent("second", null);
    const siblings = fakeSiblings([first, second]);
    const parent = { components: () => siblings };
    first.parent = () => parent;
    second.parent = () => parent;

    editor.select(first);
    expect(() => editor.getCommand("latestarr-move-up").run(editor)).not.toThrow();
    expect(first.move).not.toHaveBeenCalled();
    // The button's title still reflects the boundary after the no-op click.
    expect(titleOf(first.toolbar as never, "latestarr-move-up")).toBe("Already at the top");
  });

  it("updates the boundary titles after a successful move, without needing a reselect", () => {
    const editor = fakeEditor();
    registerReorderControls(editor as never);

    const first = fakeComponent("first", null);
    const second = fakeComponent("second", null);
    const siblings = fakeSiblings([first, second]);
    const parent = { components: () => siblings };
    first.parent = () => parent;
    second.parent = () => parent;

    editor.select(second);
    expect(titleOf(second.toolbar as never, "latestarr-move-down")).toBe("Already at the bottom");

    // The real component.move(parent, { at }) detaches and reinserts the
    // component in its parent's children — simulate that here so the
    // siblings array (and thus the recomputed boundary state) reflects the
    // move, the same as it would for the real GrapesJS Components collection.
    second.move.mockImplementation((_parent: unknown, opts: { at: number }) => {
      const models = siblings.__models;
      models.splice(models.indexOf(second), 1);
      models.splice(opts.at, 0, second);
    });
    editor.getCommand("latestarr-move-up").run(editor);

    expect(titleOf(second.toolbar as never, "latestarr-move-up")).toBe("Already at the top");
    expect(titleOf(second.toolbar as never, "latestarr-move-down")).toBe("Move down");
  });
});
