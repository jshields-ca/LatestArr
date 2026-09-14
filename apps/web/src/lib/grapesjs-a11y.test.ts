import { describe, expect, it, vi } from "vitest";
import { makeGrapesJsKeyboardOperable } from "./grapesjs-a11y";

function buildDom(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = `
    <span class="gjs-block" title="Header">Header</span>
    <span class="gjs-pn-btn" title="Open Blocks"></span>
    <span class="gjs-layer-title">Section</span>
    <span class="unrelated">skip me</span>
  `;
  document.body.appendChild(root);
  return root;
}

describe("makeGrapesJsKeyboardOperable", () => {
  it("makes blocks, panel buttons, and layer titles focusable and role=button", () => {
    const root = buildDom();
    makeGrapesJsKeyboardOperable(root);

    for (const selector of [".gjs-block", ".gjs-pn-btn", ".gjs-layer-title"]) {
      const el = root.querySelector(selector)!;
      expect(el.getAttribute("tabindex")).toBe("0");
      expect(el.getAttribute("role")).toBe("button");
    }
  });

  it("leaves unrelated elements untouched", () => {
    const root = buildDom();
    makeGrapesJsKeyboardOperable(root);

    const unrelated = root.querySelector(".unrelated")!;
    expect(unrelated.hasAttribute("tabindex")).toBe(false);
  });

  it("triggers a click when Enter or Space is pressed", () => {
    const root = buildDom();
    makeGrapesJsKeyboardOperable(root);
    const block = root.querySelector<HTMLElement>(".gjs-block")!;
    const onClick = vi.fn();
    block.addEventListener("click", onClick);

    block.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    block.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("does not trigger a click for an unrelated key", () => {
    const root = buildDom();
    makeGrapesJsKeyboardOperable(root);
    const block = root.querySelector<HTMLElement>(".gjs-block")!;
    const onClick = vi.fn();
    block.addEventListener("click", onClick);

    block.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not double-apply to an element that already has a tabindex", () => {
    const root = buildDom();
    const block = root.querySelector<HTMLElement>(".gjs-block")!;
    block.setAttribute("tabindex", "-1");

    makeGrapesJsKeyboardOperable(root);

    expect(block.getAttribute("tabindex")).toBe("-1");
  });

  it("patches elements added to the DOM later, not just what's there at call time", async () => {
    // Regression test: GrapesJS only renders the block panel's actual
    // block list into the DOM the first time it's opened, well after this
    // function's initial pass runs — a one-time querySelectorAll would
    // silently miss every block, which is exactly what shipped and broke
    // keyboard block-adding before this was caught in manual testing.
    const root = document.createElement("div");
    document.body.appendChild(root);
    makeGrapesJsKeyboardOperable(root);

    const lateBlock = document.createElement("span");
    lateBlock.className = "gjs-block";
    lateBlock.title = "Header";
    root.appendChild(lateBlock);

    await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(lateBlock.getAttribute("tabindex")).toBe("0");
    expect(lateBlock.getAttribute("role")).toBe("button");
  });

  it("returns a cleanup function that stops patching further insertions", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const stop = makeGrapesJsKeyboardOperable(root);
    stop();

    const lateBlock = document.createElement("span");
    lateBlock.className = "gjs-block";
    root.appendChild(lateBlock);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(lateBlock.hasAttribute("tabindex")).toBe(false);
  });
});
