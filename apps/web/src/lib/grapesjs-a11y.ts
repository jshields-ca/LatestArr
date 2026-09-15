// GrapesJS's default UI (block list, panel buttons) renders plain <span>s
// with no tabindex — a keyboard-only user can Tab straight from "Save"
// into the canvas iframe and back out, never reaching the block panel,
// layer manager, or any panel button at all. This makes every such
// element keyboard-focusable and Enter/Space-activatable, firing the same
// click handler a mouse click would (which is what actually runs the
// GrapesJS command or, for blocks, the onClick fallback registered in
// grapesjs-blocks.ts).
//
// A MutationObserver, not a one-time pass: the block panel's actual block
// list only renders into the DOM the first time "Open Blocks" is clicked
// (confirmed by testing — at editor "load" time the .gjs-block elements
// don't exist yet), so anything patched only once at load would miss it.
const KEYBOARD_OPERABLE_SELECTOR = ".gjs-block, .gjs-pn-btn, .gjs-layer-title, .gjs-toolbar-item";

function patch(el: HTMLElement): void {
  if (el.hasAttribute("tabindex")) return;
  el.setAttribute("tabindex", "0");
  if (!el.hasAttribute("role")) el.setAttribute("role", "button");
  el.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    el.click();
  });
}

function patchAll(node: ParentNode): void {
  for (const el of node.querySelectorAll<HTMLElement>(KEYBOARD_OPERABLE_SELECTOR)) {
    patch(el);
  }
}

// Returns a cleanup function to disconnect the observer, for the
// component's effect cleanup alongside editor.destroy().
export function makeGrapesJsKeyboardOperable(root: HTMLElement): () => void {
  patchAll(root);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches(KEYBOARD_OPERABLE_SELECTOR)) patch(node);
        patchAll(node);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });

  return () => observer.disconnect();
}
