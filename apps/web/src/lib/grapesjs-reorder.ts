import type { Component, Editor, ToolbarButtonProps } from "grapesjs";

const MOVE_UP_ID = "latestarr-move-up";
const MOVE_DOWN_ID = "latestarr-move-down";

// A dimmed, visual-only "disabled" look for a boundary button — GrapesJS's
// ButtonProps has no real `disabled` flag, and fighting the toolbar view to
// add one isn't worth it for what's ultimately just a tooltip backing a
// no-op click (see moveSelectedComponent below).
const DISABLED_CLASS = "latestarr-toolbar-btn--disabled";

// Solid, flat-fill triangles at the same 24x24 viewBox and visual weight as
// GrapesJS's own built-in toolbar icons (move/clone/delete, all inline SVG
// from GrapesJS's own icon set — see grapesjs-icons.ts's header comment for
// why those already render fine). A stroke-based Lucide icon here would
// look like a distinctly different, thinner icon family sitting right next
// to those three. This deliberately isn't GrapesJS's own built-in "arrowUp"
// icon either: that exact icon already appears earlier in this same
// toolbar as the unlabeled "select parent" button, and reusing it for
// "move up" would make two different actions look identical.
const ICON_UP = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12,7L18,17H6L12,7Z" /></svg>';
const ICON_DOWN = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12,17L6,7H18L12,17Z" /></svg>';

type Position = { parent: Component; siblings: ReturnType<Component["components"]>; index: number };

function getPosition(component: Component | undefined | null): Position | null {
  const parent = component?.parent();
  if (!component || !parent) return null;
  const siblings = parent.components();
  return { parent, siblings, index: siblings.indexOf(component) };
}

function buildMoveButton(
  id: string,
  icon: string,
  disabled: boolean,
  activeTitle: string,
  disabledTitle: string,
): ToolbarButtonProps {
  const title = disabled ? disabledTitle : activeTitle;
  return {
    id,
    command: id,
    label: icon,
    attributes: {
      class: disabled ? DISABLED_CLASS : "",
      title,
      "aria-label": title,
      "aria-disabled": String(disabled),
    },
  };
}

// GrapesJS's own per-component toolbar only offers drag (move), clone, and
// delete — there's no way to reorder two blocks without a mouse drag.
// Reordering is exactly the kind of drag-only operation the plan's
// accessibility bar calls out as needing a non-drag alternative, the same
// reasoning behind appendBlockToCanvas in grapesjs-blocks.ts for adding a
// block in the first place.
function moveSelectedComponent(editor: Editor, delta: number): void {
  const component = editor.getSelected();
  const position = getPosition(component);
  if (!component || !position) return;

  const newIndex = position.index + delta;
  if (newIndex < 0 || newIndex >= position.siblings.length) return;

  // Backbone's Collection.add() is a no-op for a model already in the
  // collection (confirmed by manual testing: it neither throws nor moves
  // it), so reordering needs GrapesJS's own purpose-built API instead —
  // component.move(destination, opts) detaches and reinserts it without
  // destroying it, unlike remove()+add().
  component.move(position.parent, { at: newIndex });

  // The move just changed this component's index, which may have changed
  // whether it's now at the top/bottom — refresh the buttons' tooltip and
  // dimmed state so they reflect the new position immediately rather than
  // needing a reselect.
  updateMoveButtonsState(component);
}

// Keeps the Move up/down buttons' hover title (and dimmed visual state) in
// sync with whether the selected component is already at the top/bottom of
// its parent. There's no boundary-change event to subscribe to on a
// component in GrapesJS, so this is called at the two points where this
// page can actually change a component's position: right after the
// buttons are first added (component:selected) and right after one of our
// own move commands runs, above. A drag-and-drop reorder elsewhere in the
// tree won't refresh this until the component is reselected — acceptable
// given the only reordering UI this page exposes is these two buttons.
function updateMoveButtonsState(component: Component): void {
  const toolbar = component.toolbar ?? [];
  if (!toolbar.some((item) => item.id === MOVE_UP_ID)) return;

  const position = getPosition(component);
  const atTop = !position || position.index <= 0;
  const atBottom = !position || position.index >= position.siblings.length - 1;

  component.set(
    "toolbar",
    toolbar.map((item) => {
      if (item.id === MOVE_UP_ID) return buildMoveButton(MOVE_UP_ID, ICON_UP, atTop, "Move up", "Already at the top");
      if (item.id === MOVE_DOWN_ID) {
        return buildMoveButton(MOVE_DOWN_ID, ICON_DOWN, atBottom, "Move down", "Already at the bottom");
      }
      return item;
    }),
  );
}

export function registerReorderControls(editor: Editor): void {
  editor.Commands.add(MOVE_UP_ID, { run: (ed) => moveSelectedComponent(ed, -1) });
  editor.Commands.add(MOVE_DOWN_ID, { run: (ed) => moveSelectedComponent(ed, 1) });

  editor.on("component:selected", (component: Component) => {
    const toolbar = component.toolbar ?? [];
    if (toolbar.some((item) => item.id === MOVE_UP_ID)) return;

    const position = getPosition(component);
    const atTop = !position || position.index <= 0;
    const atBottom = !position || position.index >= position.siblings.length - 1;

    component.set("toolbar", [
      ...toolbar,
      buildMoveButton(MOVE_UP_ID, ICON_UP, atTop, "Move up", "Already at the top"),
      buildMoveButton(MOVE_DOWN_ID, ICON_DOWN, atBottom, "Move down", "Already at the bottom"),
    ]);
  });
}
