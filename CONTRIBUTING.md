# Contributing to LatestArr

Thanks for your interest in contributing! LatestArr is early-stage, so the project structure and conventions below will keep evolving — if something here is out of date, a PR fixing it is itself a welcome contribution.

## Project structure

LatestArr is a pnpm + Turborepo monorepo:

```
apps/server               Fastify API, scheduler, mailer, auth, email render pipeline
apps/web                  Vite + React admin/builder SPA
packages/adapters/core    The SourceAdapter contract + registry
packages/adapters/<name>  One package per source integration (e.g. tautulli)
packages/db               Drizzle schema and migrations
packages/crypto           Envelope encryption for credentials at rest
packages/config           Shared eslint/tsconfig/prettier config
docker/                   Container build files
```

## Development setup

Requirements: Node.js (see `.nvmrc`/`engines` for the version) and [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm turbo run dev      # runs apps/server and apps/web in watch mode
pnpm turbo run lint typecheck build   # what CI runs on every PR
```

## Adding a new source adapter

Every source (Plex, Tautulli, Audiobookshelf, RomM, ...) is an isolated package under `packages/adapters/` implementing a shared `SourceAdapter` TypeScript interface (see `packages/adapters/core`). To add a new source:

1. Create `packages/adapters/<your-source>/`.
2. Implement `testConnection`, `listLibraries`, and `fetchRecentItems`, returning the normalized `NewItem` shape defined in `packages/adapters/core`.
3. Register your adapter's `kind` in the adapter registry.
4. Add tests covering at least a successful fetch and an auth-failure case.
5. Open a PR — no changes to the scheduler, database schema, or UI core should be necessary for a new adapter.

If you're proposing support for a source that isn't in the README's supported-sources table, please open an "Adapter request" issue first so we can discuss API stability and auth model before you invest implementation time.

## Coding standards

- TypeScript everywhere; avoid `any` where a real type is feasible.
- Run `pnpm turbo run lint typecheck` before opening a PR — CI enforces the same.
- Prefer small, focused PRs over large ones; it makes review and revert both easier.
- Commit messages: please use [Conventional Commits](https://www.conventionalcommits.org/) style (`feat:`, `fix:`, `docs:`, `chore:`, ...).
- Accessibility: any UI change touching `apps/web` should remain fully keyboard-operable and pass the axe-core checks in CI.

## Pull requests

- Fill out the PR template — it includes a short checklist (tests, docs, accessibility) that reviewers will check for.
- Link the issue your PR addresses, if any.
- Be responsive to review feedback; PRs that go quiet for a long time may be closed and can always be reopened.
- **If your change is user-facing** (a new feature, a fix, a behavior change — not internal refactors, tests-only changes, or docs typos), add a changeset: run `pnpm changeset`, pick a bump type (see below), and write it in two parts — see "Writing a changeset" below. Commit the generated `.changeset/*.md` file with your PR.

### Writing a changeset

A changeset's body becomes a `CHANGELOG.md` bullet and, unedited, the notes on the GitHub Release — so it needs to read for a self-hoster deciding whether to upgrade, not just for other contributors. Write it in two parts:

1. **A one- or two-sentence plain-language lede**, prefixed with a bold category tag: `**New:**` for a feature, `**Improved:**` for a behavior/UI change, `**Fixed:**` for a bug fix. No file paths, code identifiers, or "why" reasoning — just what changed and why a user would care.
2. **A `<details><summary>Technical details</summary>...</details>` block** underneath, for the implementation rationale, file references, and edge cases a contributor or future-you would want. As detailed as you like — it's collapsed by default, so it costs nothing for a reader who just wants the headline.

```markdown
---
"@latestarr/web": minor
---

**New:** Add a single "All New (This Period)" block to the template editor — drop it in and it shows everything added recently, grouped by type, instead of six separate blocks.

<details>
<summary>Technical details</summary>

Addresses production feedback that there was no way to show "everything new this period" across content kinds. Registered as its own GrapesJS component type reusing the standalone Media List block's card markup...

</details>
```

This renders as a working collapsible section on GitHub (`CHANGELOG.md` and Release notes both support raw `<details>`/`<summary>`) with no extra tooling — `scripts/write-changelog.mjs` flattens the body's newlines into one line per bullet, which doesn't affect how the HTML renders.

## Versioning & releases

LatestArr follows [Semantic Versioning](https://semver.org/) and keeps a [Keep a Changelog](https://keepachangelog.com/)-formatted `CHANGELOG.md`, managed with [Changesets](https://github.com/changesets/changesets). While the major version is `0` (pre-1.0), expect faster-moving, potentially breaking changes between minor versions — this is normal per semver's own rules for initial development, and matches where the project actually is right now (no stability guarantees yet).

- Every workspace package versions together in lockstep (see `.changeset/config.json`'s `fixed` group) — there's one meaningful version number for the whole app, not independent versions per internal package. Every package is `private: true` (this app isn't published to npm), so `.changeset/config.json` sets `privatePackages.version: true` — without it, Changesets silently skips versioning private packages entirely, which is exactly what happened for months before this was caught.
- Picking a bump type when running `pnpm changeset`: `patch` for bug fixes and internal improvements, `minor` for new features (including a new source adapter), `major` reserved for 1.0 and any deliberate breaking change after that.
- **Releases are automated** (`.github/workflows/release.yml`): every push to `main` that carries pending changesets opens or updates a "Version Packages" PR. Merging that PR runs `pnpm version-packages` (writes one consolidated `CHANGELOG.md` entry via `scripts/write-changelog.mjs`, bumps every package version, syncs the root `package.json`), and the next push — the merge itself — cuts a git tag and a GitHub Release with that entry as its notes. Nothing to run by hand; a maintainer's only job is reviewing and merging the Version Packages PR.
- **CHANGELOG.md entries are grouped and auto-linked**: `scripts/write-changelog.mjs` buckets each version's changesets under `### New` / `### Improved` / `### Fixed` subheadings (parsed from the bold lede tag — see "Writing a changeset" above), and resolves each changeset's own PR via `@changesets/get-github-info` (using the `repo` field in `.changeset/config.json`), appending `([#123](...))` right after the lede sentence. This is best-effort — no `GITHUB_TOKEN`, a network hiccup, or GitHub not yet indexing a very fresh commit all degrade to "no link" rather than failing the release. A changeset that doesn't start with a recognized category tag still renders, under an `### Other` heading, rather than being dropped.
- **Batch releases around a coherent theme rather than cutting one for every merge.** A release with a clear "why" (a described feature, a themed round of fixes) reads as intentional; a trickle of thinly-described patch releases reads as noisy and can make the project look less stable than it is. Hold the Version Packages PR open and keep letting it accumulate changesets from related work — merge it when there's a coherent story to tell, not on every single PR. The exception is an urgent fix (a real bug, a security issue) that shouldn't wait on unrelated work to land.
- **Before considering a release done**, once the Version Packages PR is merged and the GitHub Release exists:
  1. Add a one-line **release theme** to the top of the GitHub Release (e.g. "Clickable newsletters + admin UI polish") — the changelog's grouped bullets are the detail, this is the one-sentence "why."
  2. For any release that touched `apps/web`, add a **Highlights** section with a screenshot or two of what's new below the theme line — the bullets say what changed, a screenshot shows it. Manual step; no tooling for it.
  3. Do a **quick full docs pass** — `README.md` (feature list, supported-sources table, screenshots), `CONTRIBUTING.md`, and anything under `docs/` — for anything the release makes stale, not just files the release's own PRs happened to touch.

## Testing in-progress work without a release

`ghcr.io/jshields-ca/latestarr:dev` is a floating image rebuilt on every push to the `dev` branch (`.github/workflows/dev-image.yml`), separate from the tagged `:latest`/`:vX.Y.Z` images `release.yml` cuts. It exists so in-progress work can be pulled onto a real box without going through the version/changelog/GitHub Release flow above.

- To test a change: merge or push it onto `dev`, wait for the workflow to publish the image, then on the test box set `LATESTARR_VERSION=dev` in `.env` and `docker compose pull && docker compose up -d`. Existing `latestarr-data` volumes/appdata work unchanged — this only swaps the image tag.
- `dev` is a working branch, not a release channel — it isn't kept in sync with `main` automatically and can be force-pushed or rebuilt from `main` at any time. Don't point a production instance at `:dev`.
- Switch back to a real release with `LATESTARR_VERSION=latest` (or a pinned `vX.Y.Z`) and pull again.

## Reporting bugs / requesting features

Use the issue templates (Bug report / Feature request / Adapter request) — they ask for the details needed to reproduce or evaluate the request. Please search existing issues first to avoid duplicates.

## Security issues

Do **not** open a public issue for a security vulnerability — see [`SECURITY.md`](SECURITY.md) for the disclosure process.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you're expected to uphold it.
