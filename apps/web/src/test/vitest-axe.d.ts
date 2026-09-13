// jest-axe's own types declare `toHaveNoViolations` on the `jest` global
// namespace (see @types/jest-axe), which this project doesn't install —
// we use vitest, not jest. This merges the same matcher into vitest's
// own Assertion interface instead, per Vitest's documented pattern for
// jest-compatible custom matchers.
import "vitest";

interface AxeMatchers<R = unknown> {
  toHaveNoViolations(): R;
}

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Vitest's documented pattern for merging custom matchers requires an empty extending interface here.
  interface Assertion<T = unknown> extends AxeMatchers<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- same as above.
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
