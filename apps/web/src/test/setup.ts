import "@testing-library/jest-dom/vitest";
import { toHaveNoViolations } from "jest-axe";
import { expect } from "vitest";

expect.extend(toHaveNoViolations);

// jsdom doesn't implement ResizeObserver (it's out of jsdom's DOM-spec
// scope, not a bug) — Radix UI's Switch uses it internally to size a
// hidden bubble input, so any test mounting one needs this stub.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom also doesn't implement pointer capture or scrollIntoView (again,
// out of jsdom's DOM-spec scope) — Radix UI's Select relies on both for
// pointer-based open/close and keeping the highlighted option in view.
if (typeof Element.prototype.hasPointerCapture === "undefined") {
  Element.prototype.hasPointerCapture = () => false;
}
if (typeof Element.prototype.setPointerCapture === "undefined") {
  Element.prototype.setPointerCapture = () => {};
}
if (typeof Element.prototype.releasePointerCapture === "undefined") {
  Element.prototype.releasePointerCapture = () => {};
}
if (typeof Element.prototype.scrollIntoView === "undefined") {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom's CSS engine (nwsapi) takes ~500ms per call to resolve the
// `:modal` pseudo-class (a known nwsapi perf pathology, unrelated to
// selector complexity — a trivial selector like "div" is sub-millisecond).
// Radix UI's Popper positioning (used by Popover, DropdownMenu, Tooltip,
// etc.) calls `element.matches(':modal')`/`':popover-open'` on every
// overflow-ancestor it walks while computing collision avoidance, so
// opening so much as one of these components under jsdom takes 10-15+
// real seconds and can blow a test's timeout. No element in this app
// tree is ever an open native <dialog> or Popover-API element (Radix
// implements both in JS, not via the native APIs those pseudo-classes
// describe), so short-circuiting them to `false` is always correct here,
// not just a testing shortcut.
if (typeof Element.prototype.matches === "function") {
  const originalMatches = Element.prototype.matches;
  Element.prototype.matches = function (this: Element, selector: string) {
    if (selector === ":modal" || selector === ":popover-open") return false;
    return originalMatches.call(this, selector);
  } as typeof Element.prototype.matches;
}
