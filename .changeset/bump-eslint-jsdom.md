---
"@latestarr/web": patch
"@latestarr/server": patch
"@latestarr/crypto": patch
"@latestarr/db": patch
"@latestarr/config": patch
"@latestarr/adapter-core": patch
"@latestarr/adapter-plex": patch
"@latestarr/adapter-tautulli": patch
"@latestarr/adapter-audiobookshelf": patch
"@latestarr/adapter-booklore-family": patch
"@latestarr/adapter-romm": patch
---

Bump eslint (9 → 10) and @eslint/js (9 → 10) across every package, and jsdom (25 → 30) in apps/web's test environment. Dev-tooling only, no runtime dependency changes.

The Dependabot PRs for these (#97, #104, #105) failed CI with a stale, out-of-sync pnpm-lock.yaml on their branch — reproduced locally with a freshly regenerated lockfile and confirmed all 40 lint/typecheck/build/test tasks pass cleanly; `eslint-plugin-jsx-a11y`'s declared peer range hasn't caught up to eslint 10 yet, but it lints without error in practice.
