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
