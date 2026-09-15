import type { Component, Editor } from "grapesjs";

const MOVE_UP_ID = "latestarr-move-up";
const MOVE_DOWN_ID = "latestarr-move-down";

// GrapesJS's default per-component toolbar only offers drag (move), clone,
// and delete — there's no way to reorder two blocks without a mouse drag.
// Reordering is exactly the kind of drag-only operation the plan's
// accessibility bar calls out as needing a non-drag alternative, the same
// reasoning behind appendBlockToCanvas in grapesjs-blocks.ts for adding a
// block in the first place.
function moveSelectedComponent(editor: Editor, delta: number): void {
  const component = editor.getSelected();
  const parent = component?.parent();
  if (!component || !parent) return;

  const siblings = parent.components();
  const index = siblings.indexOf(component);
  const newIndex = index + delta;
  if (newIndex < 0 || newIndex >= siblings.length) return;

  // Backbone's Collection.add() is a no-op for a model already in the
  // collection (confirmed by manual testing: it neither throws nor moves
  // it), so reordering needs GrapesJS's own purpose-built API instead —
  // component.move(destination, opts) detaches and reinserts it without
  // destroying it, unlike remove()+add().
  component.move(parent, { at: newIndex });
}

export function registerReorderControls(editor: Editor): void {
  editor.Commands.add(MOVE_UP_ID, { run: (ed) => moveSelectedComponent(ed, -1) });
  editor.Commands.add(MOVE_DOWN_ID, { run: (ed) => moveSelectedComponent(ed, 1) });

  editor.on("component:selected", (component: Component) => {
    const toolbar = component.toolbar ?? [];
    if (toolbar.some((item) => item.id === MOVE_UP_ID)) return;

    component.set("toolbar", [
      ...toolbar,
      {
        id: MOVE_UP_ID,
        command: MOVE_UP_ID,
        label: "&uarr;",
        attributes: { title: "Move up", "aria-label": "Move up" },
      },
      {
        id: MOVE_DOWN_ID,
        command: MOVE_DOWN_ID,
        label: "&darr;",
        attributes: { title: "Move down", "aria-label": "Move down" },
      },
    ]);
  });
}
