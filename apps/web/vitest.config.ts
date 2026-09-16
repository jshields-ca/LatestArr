import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // RTL registers its automatic post-test cleanup() by detecting a
    // global `afterEach` at import time — without this, DOM from one
    // test leaks into the next within the same file.
    globals: true,
    // The default 5s is tight here: once a Radix Select has been opened
    // and closed in a test, jsdom's lack of real layout/pointer-capture
    // support makes the *next* async Testing Library call (userEvent
    // click, `findBy*`, `waitFor`) noticeably slower to settle than in a
    // real browser — still correct, just not instant, and each
    // occurrence can cost 30-40s. Tests with more than one such
    // occurrence set their own even higher per-test timeout.
    testTimeout: 120000,
  },
});
