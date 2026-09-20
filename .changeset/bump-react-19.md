---
"@latestarr/web": patch
---

Bump react and react-dom (18 → 19) and their `@types` packages. Dev/runtime dependency only.

Low migration risk in this codebase: `main.tsx` already uses `ReactDOM.createRoot` (no legacy `ReactDOM.render` to migrate), there's no direct `react-dom/test-utils` import (React 19 moved `act` into `react` itself), and no component uses `defaultProps` on a function component (removed in 19). `@testing-library/react@16` (already in use) and `react-router-dom@7` already support React 19.

`pnpm turbo run lint typecheck build test` is fully green (40/40 tasks, 225 web tests, no React deprecation warnings in test output). Beyond the test suite, built the app and drove it with a real headless Chromium session against the built server (signup → dashboard → navigated Sources/Recipients/Newsletters/Templates → opened the Add Source dialog) — no console errors, no visual regressions, confirmed by screenshot.
