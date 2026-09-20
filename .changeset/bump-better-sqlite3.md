---
"@latestarr/db": patch
---

Bump better-sqlite3 (11 → 12.11.1) — the DB driver, and the last of the deferred major-version Dependabot pass. Runtime dependency, and a native module, so this carries the same "native module" build risk as before across platforms, not just app-level behavior.

Landed on 12.11.1 rather than Dependabot's proposed 13.0.3: better-sqlite3 13 dropped Node 20 support entirely (`engines: {"node": ">=22"}`), which would break this repo's Node 20.x CI job — the same class of issue jsdom 30 had (see the earlier `bump-eslint-jsdom` changeset). 12.11.1 is the latest release that still supports Node 20.x through 26.x.

- `packages/db/src/client.ts`'s usage (`new Database(path)`, `.pragma()`) and `migrate.ts`'s `drizzle-orm/better-sqlite3/migrator` are both stable, long-standing API surface — unaffected by the 11→12 bump.
- `drizzle-orm`'s own peer range for `better-sqlite3` is `>=7`, so no drizzle-orm compatibility concern either.
- The native module installs cleanly (`prebuild-install` resolved a prebuilt binary, no compile-from-source fallback needed) on this platform/Node combination.
- `pnpm turbo run lint typecheck build test` is fully green (40/40 tasks) — `packages/db`'s own tests (WAL mode, foreign keys, migrations) pass, plus every server route test that touches the DB.
- The actual cross-compile for the Docker image's `node:22-alpine` (musl libc) target isn't something this sandbox can validate directly (no Docker daemon available here) — that's what the PR's own CI "Docker build" job checks for real, same as every other bump in this batch.
