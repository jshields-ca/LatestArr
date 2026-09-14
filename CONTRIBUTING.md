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

Requirements: Node.js (see `.nvmrc`/`engines` once added) and [pnpm](https://pnpm.io/).

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
- **If your change is user-facing** (a new feature, a fix, a behavior change — not internal refactors, tests-only changes, or docs typos), add a changeset: run `pnpm changeset`, pick a bump type (see below), and write a one- or two-sentence summary in plain language. Commit the generated `.changeset/*.md` file with your PR.

## Versioning & releases

LatestArr follows [Semantic Versioning](https://semver.org/) and keeps a [Keep a Changelog](https://keepachangelog.com/)-formatted `CHANGELOG.md`, managed with [Changesets](https://github.com/changesets/changesets). While the major version is `0` (pre-1.0), expect faster-moving, potentially breaking changes between minor versions — this is normal per semver's own rules for initial development, and matches where the project actually is right now (no stability guarantees yet).

- Every workspace package versions together in lockstep (see `.changeset/config.json`'s `fixed` group) — there's one meaningful version number for the whole app, not independent versions per internal package. Every package is `private: true` (this app isn't published to npm), so `.changeset/config.json` sets `privatePackages.version: true` — without it, Changesets silently skips versioning private packages entirely, which is exactly what happened for months before this was caught.
- Picking a bump type when running `pnpm changeset`: `patch` for bug fixes and internal improvements, `minor` for new features (including a new source adapter), `major` reserved for 1.0 and any deliberate breaking change after that.
- **Releases are automated** (`.github/workflows/release.yml`): every push to `main` that carries pending changesets opens or updates a "Version Packages" PR. Merging that PR runs `pnpm version-packages` (writes one consolidated `CHANGELOG.md` entry via `scripts/write-changelog.mjs`, bumps every package version, syncs the root `package.json`), and the next push — the merge itself — cuts a git tag and a GitHub Release with that entry as its notes. Nothing to run by hand; a maintainer's only job is reviewing and merging the Version Packages PR.
- **For a release that changed anything in the WebUI**, add a "Highlights" section to the GitHub Release with a screenshot or two of what's new before considering it done — the changelog bullets say what changed, a screenshot shows it. This is a manual follow-up edit on the release GitHub just created; there's no tooling for it.

## Reporting bugs / requesting features

Use the issue templates (Bug report / Feature request / Adapter request) — they ask for the details needed to reproduce or evaluate the request. Please search existing issues first to avoid duplicates.

## Security issues

Do **not** open a public issue for a security vulnerability — see [`SECURITY.md`](SECURITY.md) for the disclosure process.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you're expected to uphold it.
