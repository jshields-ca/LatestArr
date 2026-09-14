import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // tsconfig.json has no test-file exclusion, so `tsc` (the "build"
    // script) compiles *.test.ts into dist/ alongside the source. Without
    // this, vitest's default include glob picks up both the src/*.test.ts
    // files and their compiled dist/*.test.js duplicates as separate test
    // files, running every test twice per `turbo run test` (build always
    // runs first) and doubling load for no coverage benefit.
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
