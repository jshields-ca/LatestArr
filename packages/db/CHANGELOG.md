# @latestarr/db

## 0.8.0

No changes in this release.

## 0.7.1

### Patch Changes

- e4532fd: Bump better-sqlite3 (11 → 12.11.1) — the DB driver, and the last of the deferred major-version Dependabot pass. Runtime dependency, and a native module, so this carries the same "native module" build risk as before across platforms, not just app-level behavior.

  Landed on 12.11.1 rather than Dependabot's proposed 13.0.3: better-sqlite3 13 dropped Node 20 support entirely (`engines: {"node": ">=22"}`), which would break this repo's Node 20.x CI job — the same class of issue jsdom 30 had (see the earlier `bump-eslint-jsdom` changeset). 12.11.1 is the latest release that still supports Node 20.x through 26.x.

  - `packages/db/src/client.ts`'s usage (`new Database(path)`, `.pragma()`) and `migrate.ts`'s `drizzle-orm/better-sqlite3/migrator` are both stable, long-standing API surface — unaffected by the 11→12 bump.
  - `drizzle-orm`'s own peer range for `better-sqlite3` is `>=7`, so no drizzle-orm compatibility concern either.
  - The native module installs cleanly (`prebuild-install` resolved a prebuilt binary, no compile-from-source fallback needed) on this platform/Node combination.
  - `pnpm turbo run lint typecheck build test` is fully green (40/40 tasks) — `packages/db`'s own tests (WAL mode, foreign keys, migrations) pass, plus every server route test that touches the DB.
  - The actual cross-compile for the Docker image's `node:22-alpine` (musl libc) target isn't something this sandbox can validate directly (no Docker daemon available here) — that's what the PR's own CI "Docker build" job checks for real, same as every other bump in this batch.

- 51311b4: Bump eslint (9 → 10) and @eslint/js (9 → 10) across every package, and jsdom (25 → 29.1.1) in apps/web's test environment. Dev-tooling only, no runtime dependency changes.

  The Dependabot PRs for eslint/@eslint/js (#97, #105) failed CI with a stale, out-of-sync pnpm-lock.yaml on their branch — reproduced locally with a freshly regenerated lockfile and confirmed all 40 lint/typecheck/build/test tasks pass cleanly; `eslint-plugin-jsx-a11y`'s declared peer range hasn't caught up to eslint 10 yet, but it lints without error in practice.

  jsdom's own Dependabot PR (#104) proposed 25 → 30, but jsdom 30 dropped Node 20 support entirely (`engines: "^22.22.2 || ^24.15.0 || >=26.0.0"`), which broke this repo's Node 20.x CI job with `TypeError: webidl.util.markAsUncloneable is not a function` — a real Node-runtime incompatibility, not a lockfile issue. Landing on 29.1.1 instead (the latest jsdom release that still supports Node 20.19+) gets most of the version currency without dropping Node 20 CI support, which is a bigger call than a routine dependency bump.

- 73a6d37: Bump vite (6 → 8, apps/web only), vitest (4 → 5, every package), and @vitejs/plugin-react (4 → 6, apps/web only). Dev-tooling only, no runtime dependency changes.

  Bumped all three together since they're an interlocking build/test toolchain — vitest 5 pins a vite 6+ peer, and @vitejs/plugin-react needs to track the vite major it's paired with. `pnpm turbo run lint typecheck build test` is fully green (40/40 tasks, 189 server tests, 225 web tests); no config changes needed in `apps/web/vite.config.ts` or any `vitest.config`.

## 0.7.0

No changes in this release.

## 0.6.0

No changes in this release.

## 0.5.0

No changes in this release.

## 0.4.6

No changes in this release.

## 0.4.5

No changes in this release.

## 0.4.4

No changes in this release.

## 0.4.3

No changes in this release.

## 0.4.2

No changes in this release.

## 0.4.1

No changes in this release.

## 0.4.0

No changes in this release.

## 0.3.0

No changes in this release.

## 0.2.0

No changes in this release.
