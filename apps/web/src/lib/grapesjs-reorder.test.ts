import { describe, expect, it, vi } from "vitest";
import { registerReorderControls } from "./grapesjs-reorder";

// A minimal fake of the slice of the GrapesJS Editor/Component/Components
// API this module actually uses, following the same pattern as
// grapesjs-blocks.test.ts's fakeEditor (the real Editor needs a browser
// canvas/iframe).
function fakeSiblings(models: unknown[]) {
  return {
    indexOf: (model: unknown) => models.indexOf(model),
    get length() {
      return models.length;
    },
  };
}

function fakeComponent(id: string, parent: unknown, toolbar: unknown[] = []) {
  return { id, toolbar, parent: () => parent, set: vi.fn(), move: vi.fn() };
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

describe("registerReorderControls", () => {
  it("adds Move up/down buttons to a selected component's toolbar exactly once", () => {
    const editor = fakeEditor();
    registerReorderControls(editor as never);

    const a = fakeComponent("a", null);
    editor.select(a);

    expect(a.set).toHaveBeenCalledTimes(1);
    const [, toolbar] = a.set.mock.calls[0] as [string, { id: string; command: string }[]];
    expect(toolbar.map((item) => item.id)).toEqual(["latestarr-move-up", "latestarr-move-down"]);

    // Re-selecting a component whose toolbar already carries the buttons
    // (GrapesJS persists `set` values, so the getter would now return them)
    // must not append a second pair.
    a.toolbar = toolbar;
    editor.select(a);
    expect(a.set).toHaveBeenCalledTimes(1);
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
});
