# Contributing to LatestArr

Thanks for your interest in contributing! LatestArr is early-stage, so the project structure and conventions below will keep evolving — if something here is out of date, a PR fixing it is itself a welcome contribution.

## Project structure

LatestArr is a pnpm + Turborepo monorepo:

```
apps/server         Fastify API, scheduler, mailer, auth, email render pipeline
apps/web             Vite + React admin/builder SPA
packages/adapters/   Source integrations (one package per source) + the shared adapter contract
packages/db          Drizzle schema and migrations
packages/shared-types  zod schemas/types shared between server and web
packages/config      Shared eslint/tsconfig/prettier config
docker/              Container build files
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
- Commit messages: please use [Conventional Commits](https://www.conventionalcommits.org/) style (`feat:`, `fix:`, `docs:`, `chore:`, ...) — this will drive automated changelog generation.
- Accessibility: any UI change touching `apps/web` should remain fully keyboard-operable and pass the axe-core checks in CI.

## Pull requests

- Fill out the PR template — it includes a short checklist (tests, docs, accessibility) that reviewers will check for.
- Link the issue your PR addresses, if any.
- Be responsive to review feedback; PRs that go quiet for a long time may be closed and can always be reopened.

## Reporting bugs / requesting features

Use the issue templates (Bug report / Feature request / Adapter request) — they ask for the details needed to reproduce or evaluate the request. Please search existing issues first to avoid duplicates.

## Security issues

Do **not** open a public issue for a security vulnerability — see [`SECURITY.md`](SECURITY.md) for the disclosure process.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you're expected to uphold it.
