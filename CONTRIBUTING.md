# Contributing to LatestArr

Thanks for your interest in contributing! LatestArr is early-stage, so the project structure and conventions below will keep evolving — if something here is out of date, a PR fixing it is itself a welcome contribution.

User documentation lives at [latestarr.app/docs](https://www.latestarr.app/docs). For questions, ideas, or to talk something through before you write code, use [GitHub Discussions](https://github.com/jshields-ca/LatestArr/discussions).

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
cp .env.example .env    # fill in ENCRYPTION_KEY at minimum — see the file's own comments
set -a && source .env && set +a   # apps/server reads process.env directly; nothing loads .env for you outside Docker
pnpm install
pnpm turbo run dev --env-mode=loose   # runs apps/server and apps/web in watch mode
pnpm turbo run lint typecheck build   # what CI runs on every PR
```

`--env-mode=loose` matters: Turborepo's default `strict` env mode only passes through variables it's told about, which silently drops `ENCRYPTION_KEY`, so the server exits at startup saying "ENCRYPTION_KEY isn't set" even though it's in your `.env`. `apps/web`'s Vite dev server proxies `/api` to `apps/server` on port 3000 (`apps/web/vite.config.ts`); the proxy also rewrites the outgoing `Origin` header to match, which the server's same-origin CSRF check needs to accept requests from Vite's own port.

First run: visiting `http://localhost:5173` prompts you to create the first admin account, same as a fresh Docker deployment.

## Adding a new source adapter

Every source (Plex, Tautulli, Audiobookshelf, RomM, ...) is an isolated package under `packages/adapters/` implementing a shared `SourceAdapter` TypeScript interface (see `packages/adapters/core`). To add a new source:

1. Create `packages/adapters/<your-source>/`.
2. Implement `testConnection`, `listLibraries`, and `fetchRecentItems`, returning the normalized `NewItem` shape defined in `packages/adapters/core`.
3. Add tests covering at least a successful fetch and an auth-failure case.
4. Register the adapter in `apps/server/src/app.ts` (`registerAdapter`), and give it a "Watch on"-style button label in `apps/server/src/render/source-buttons.ts`.
5. Add it to the web app:
   - its form (label, examples, credential fields) in `apps/web/src/pages/sources-page.tsx`, plus its setup-guide slug and, if it can list users, `KINDS_WITH_USER_IMPORT`;
   - its logo in `apps/web/src/assets/logos/` and `components/source-logo.tsx`, with attribution in `NOTICE.md`.
6. Add it to the README's supported-sources table (🧪 until someone confirms it on a real server), and open a PR.

The scheduler, database schema and email rendering don't need changes for a new adapter.

If you're proposing support for a source that isn't in the README's supported-sources table, please open an "Adapter request" issue first so we can discuss API stability and auth model before you invest implementation time.

## Coding standards

- TypeScript everywhere; avoid `any` where a real type is feasible.
- Run `pnpm turbo run lint typecheck` before opening a PR — CI enforces the same.
- Prefer small, focused PRs over large ones; it makes review and revert both easier.
- Commit messages: please use [Conventional Commits](https://www.conventionalcommits.org/) style (`feat:`, `fix:`, `docs:`, `chore:`, ...).
- Accessibility: any UI change touching `apps/web` should remain fully keyboard-operable and pass the axe-core checks in CI.

### Saving

Every screen follows one rule (#295), so people always know whether they need to press Save:

- **Save straight away** for single, low-risk, easily reversed changes outside a form: a switch, a one-choice select, adding someone to a group from the group's own card. Confirm it quietly (an inline "Saved" or a toast).
- **Use a Save button** where fields belong together or a half-finished state would be wrong: connection details, schedules, the design editor, settings pages. Use `SaveActions` (`components/ui/save-actions.tsx`), which is enabled only when something changed and says "Unsaved changes", and the helpers in `lib/unsaved-changes.ts`:
  - `useSavedSnapshot` or your own comparison for `dirty`;
  - `useUnsavedChanges(dirty)` to warn before reloading, closing the tab or following a sidebar link;
  - `guardClose` on a dialog's `onOpenChange`, and `await confirmDiscard()` before collapsing a panel;
  - `ref={saveShortcutRef}` on the form for Ctrl/Cmd+S.
- **Never both in one form.** Everything in a form or edit dialog waits for its Save, including lists like a recipient's groups. A dialog whose changes all save straight away gets **Done**, not **Save changes**.
- **Ask in the app's own dialog,** never `window.confirm`: `confirmAction()` from `components/confirm-dialog.tsx` (resolves true or false), with a specific title, a confirm label that names the action ("Undo import", not "OK"), and `destructive` for anything that removes or discards.

### Writing docs

The repo's docs (`README.md`, `docs/`, `.env.example`, this file) are the technical reference: precise and complete, for people comfortable with Docker and for contributors. [latestarr.app](https://www.latestarr.app/docs) is the friendly, task-first guide, written from the facts here.

- **One topic per section,** under a heading that says what people look for. Background and rationale go after the instructions, or in a code comment.
- **Short paragraphs.** Use numbered lists for steps, bullets for options, and a table for settings or variables.
- **Use the app's own words.** Name pages, buttons and fields exactly as the UI shows them, in **bold**.
- **Each fact in one place.** Link to it rather than repeating it, so copies can't drift.
- **Change them together.** A new or changed setting updates `.env.example`, `docker-compose.yml` and `docs/self-hosting.md` in the same PR. CI checks the first two agree.
- **Keep anchors stable.** The app links to `docs/self-hosting.md#locked-out`, and a backup's `README.txt` to `#restoring-a-backup`. Renaming one means updating those links.
- **Tell the site.** When a change affects what latestarr.app says, note it for the site, with the corrected facts. If the site moves a page, update the app's and README's links to it.

## Testing and review

CI runs lint, typecheck, build, every package's tests (including axe-core accessibility checks) on Node 24 and 26, and builds and smoke-tests the Docker image for amd64 and arm64. That catches broken code. It can't catch a wrong assumption, and most bugs that reached a release were in what a change *affected*, not in the lines that changed. So match the effort to the risk:

| Change | What to do |
| --- | --- |
| Wording, docs, small visual tweaks | CI only. |
| Bug fixes | A test that fails without the fix, and the **What else this affects** check below. |
| Behaviour changes: limits, fetching, sending, links, sources, auth | Both of the above, a second-pass review, and one real send on `:dev` before the release is cut. |

- **What else this affects.** Before opening a PR, search for everything that uses what you changed: a value, a limit, a default, a function or an API field. Each one either gets a test or a reason it's unaffected. Put shared limits in one constant that every user reads, so they can't drift apart. For example, `MAX_SHOWN_ITEMS` sets both the 100-item default and the **Most items per section** maximum.
- **Test data from the real thing.** An adapter's fixtures should be copied from the real app's responses or its source code, not invented. Made-up feeds hid real differences (BookOrbit's `<content>`, entry ids and audio types).
- **A second pass for behaviour changes.** Review the PR with `/code-review`, plus `/security-review` when it touches anything in the security list below. Not needed for small fixes.
- **A real send before release.** Push to `dev` (`git push origin main:dev`), let `:dev` send one real newsletter, and check it, before merging the Version Packages PR. For behaviour changes, don't cut the release the same day the change was written.

### Security

LatestArr is built to be exposed to the internet, so treat these as security-relevant, and say how each is handled in the PR:

- **Untrusted data in emails or pages.** Titles, summaries, links and images come from sources; names and emails come from recipients and imports. Keep Handlebars' escaping (`{{ }}`, never `{{{ }}}` for that data), check every URL with `isHttpUrl` before it reaches an `href` or `src`, and validate request bodies with zod.
- **New or changed API routes.** Every route needs a signed-in user and the right role. `security.test.ts` fails for a route that isn't listed as public or given a role, so add yours there deliberately.
- **Outbound requests.** Anything that fetches a URL (sources, webhooks, images) uses the shared timeout (`SOURCE_REQUEST_TIMEOUT_MS`) and size limits (`readBytesCapped`), and only admins can choose its address.
- **Credentials and sessions.** Secrets are encrypted at rest, never returned by the API, and never logged. The logger redacts known fields, so name a new secret field so it's caught, or add it to the redaction list.
- **New settings and defaults.** Default to the safe option, and document what changes when someone turns it on (like `TRUST_PROXY`).

Report vulnerabilities privately; see [`SECURITY.md`](SECURITY.md).

## Pull requests

- Fill out the PR template: what else your change affects, then a short checklist (tests, docs, accessibility, security, and for behaviour changes a review pass and a real send). See [Testing and review](#testing-and-review).
- Link the issue your PR addresses, if any.
- Be responsive to review feedback; PRs that go quiet for a long time may be closed and can always be reopened.
- **If your change is user-facing** (a new feature, a fix, a behavior change — not internal refactors, tests-only changes, or docs typos), add a changeset: run `pnpm changeset`, pick a bump type (see below), and write it in two parts — see "Writing a changeset" below. Commit the generated `.changeset/*.md` file with your PR.

### Writing a changeset

A changeset's body becomes a `CHANGELOG.md` bullet, and its lede becomes a line in the GitHub Release notes, so it needs to read for a self-hoster deciding whether to upgrade, not just for other contributors. Write it in two parts:

1. **A one- or two-sentence plain-language lede**, prefixed with a bold category tag: `**New:**` for a feature, `**Improved:**` for a behavior/UI change, `**Fixed:**` for a bug fix. No file paths, code identifiers, or "why" reasoning — just what changed and why a user would care. This is the only part that appears in the GitHub Release.
2. **A `<details><summary>Technical details</summary>...</details>` block** underneath, for the implementation rationale, file references, and edge cases a contributor or future-you would want. As detailed as you like. It's kept in `CHANGELOG.md` (collapsed) and left out of the Release notes.

A few rules keep the Release notes short and accurate:

- **Only changes a user would notice.** Tests-only fixes, CI changes, and refactors don't get a changeset, even when they fix something (a flaky test is not a "Fixed" item for someone running LatestArr).
- **One tag per kind of change.** If a PR both fixes something and adds something, give each its own tag (`**Fixed:** ... **New:** ...`). Each tag becomes its own bullet under the right heading, so a new feature never ends up listed under Fixed.
- **One changeset per PR.** When you add to a PR that already has one, edit that changeset instead of adding a second, so the Release doesn't list the same PR twice.

```markdown
---
"@latestarr/web": minor
---

**New:** Designs can show a "Most watched" section: turn it on in the design editor and choose how many items it lists.

<details>
<summary>Technical details</summary>

Adds `sections.mostWatched` to the design settings schema and renders it with the `mediaList` helper's `sort="mostWatched"` pool...

</details>
```

In `CHANGELOG.md` this renders as a collapsible section on GitHub. `scripts/write-changelog.mjs` keeps each changeset's structure (the lede on one line with its PR link, then any bullets and the `<details>` block indented beneath it), and `scripts/build-release-notes.mjs` strips the `<details>` block when it builds the Release notes.

## Versioning & releases

LatestArr follows [Semantic Versioning](https://semver.org/) and keeps a [Keep a Changelog](https://keepachangelog.com/)-formatted `CHANGELOG.md`, managed with [Changesets](https://github.com/changesets/changesets). While the major version is `0` (pre-1.0), expect faster-moving, potentially breaking changes between minor versions — this is normal per semver's own rules for initial development, and matches where the project actually is right now (no stability guarantees yet).

- Every workspace package versions together in lockstep (see `.changeset/config.json`'s `fixed` group) — there's one meaningful version number for the whole app, not independent versions per internal package. Every package is `private: true` (this app isn't published to npm), so `.changeset/config.json` sets `privatePackages.version: true`; without it, Changesets silently skips versioning private packages.
- Picking a bump type when running `pnpm changeset`: `patch` for bug fixes and internal improvements, `minor` for new features (including a new source adapter), `major` reserved for 1.0 and any deliberate breaking change after that.
- **Releases are automated** (`.github/workflows/release.yml`): every push to `main` that carries pending changesets opens or updates a "Version Packages" PR. Merging that PR runs `pnpm version-packages` (writes one consolidated `CHANGELOG.md` entry via `scripts/write-changelog.mjs`, bumps every package version, syncs the root `package.json`), and the next push — the merge itself — cuts a git tag and a GitHub Release. Nothing to run by hand; a maintainer's job is writing the release highlights (below), then reviewing and merging the Version Packages PR. That PR is pushed with `GITHUB_TOKEN`, which doesn't start other workflows, so only CodeQL runs on it at first: close and reopen it to run the required checks before merging.
- **Release notes are built, not copied**: `scripts/build-release-notes.mjs` assembles the GitHub Release body from the version's highlights file, that version's `CHANGELOG.md` section with the Technical details removed, an "Upgrading" section (the `docker pull` line, plus a database-changes note when the release added migrations), and a link to the full changelog. Preview it locally with `node scripts/build-release-notes.mjs <version>`.
- **CHANGELOG.md entries are grouped and auto-linked**: `scripts/write-changelog.mjs` buckets each version's changesets under `### New` / `### Improved` / `### Fixed` subheadings (parsed from the bold lede tag — see "Writing a changeset" above), and resolves the PR that added each changeset (`git log --diff-filter=A`, so rewording a changeset later doesn't move its link) via `@changesets/get-github-info` (using the `repo` field in `.changeset/config.json`), appending `([#123](...))` right after the lede sentence. This is best-effort — no `GITHUB_TOKEN`, a network hiccup, or GitHub not yet indexing a very fresh commit all degrade to "no link" rather than failing the release. A changeset that doesn't start with a recognized category tag still renders, under an `### Other` heading, rather than being dropped.
- **Batch releases around a coherent theme rather than cutting one for every merge.** A release with a clear "why" (a described feature, a themed round of fixes) reads as intentional; a trickle of thinly-described patch releases reads as noisy and can make the project look less stable than it is. Hold the Version Packages PR open and keep letting it accumulate changesets from related work — merge it when there's a coherent story to tell, not on every single PR. The exception is an urgent fix (a real bug, a security issue) that shouldn't wait on unrelated work to land.
- **After the release is out**, do a quick full docs pass: `README.md` (feature list, supported-sources table, screenshots), `CONTRIBUTING.md`, and anything under `docs/`, for anything the release makes stale, not just files the release's own PRs happened to touch.

### Release highlights

Every release opens with a short **Highlights** section written by a person: a one-line theme in bold, then two to four plain-language bullets on what matters most. For a release that changed the web UI, add a screenshot or two. It lives in `.github/release-highlights/vX.Y.Z.md` and is written on the Version Packages PR, right before merging it:

1. The release workflow posts a comment on the Version Packages PR with a **Write the highlights** link. It opens the GitHub editor on that PR's branch with the file already named and a template (`.github/release-highlights/TEMPLATE.md`) filled in.
2. Replace the template's comments with the highlights and commit. The **Release highlights** CI check on the PR stays red until the file has real content, and the comment switches to a ✅.
3. Merge the PR. The highlights appear at the top of the GitHub Release.

Write them last. changesets/action rebuilds the Version Packages branch from `main` whenever another PR merges, which drops the file; the comment and the red check come back when that happens. (Committing the file to `main` in a normal PR also works, if you already know the version number.)

For screenshots, drag an image into any GitHub comment box, copy the link GitHub generates, and paste it into the file as `![Description](link)`. Breaking changes or manual upgrade steps go under a `### Before you upgrade` heading in the same file.

## Testing in-progress work without a release

`ghcr.io/jshields-ca/latestarr:dev` is a floating image rebuilt on every push to the `dev` branch (`.github/workflows/dev-image.yml`), separate from the tagged `:latest`/`:vX.Y.Z` images `release.yml` cuts. It exists so in-progress work can be pulled onto a real box without going through the version/changelog/GitHub Release flow above.

- **Land PRs on `main` as normal, not on `dev`.** CI (lint/typecheck/build/CodeQL), review, and changeset accumulation all happen against `main` — that's the only place those gates run. `dev` is just a floating pointer for testing, not a second line of development; committing straight to it would fork history and mean redoing the same work to get it into `main` later.
- **To get a fresh `:dev` image**, fast-forward the branch to whatever's on `main`: `git push origin main:dev`. This triggers `dev-image.yml`, which publishes `ghcr.io/jshields-ca/latestarr:dev`. Do this whenever there's new work on `main` worth testing — after one PR or after a batch, whichever fits.
- On the test box: set `LATESTARR_VERSION=dev` in `.env`, then `docker compose pull && docker compose up -d`. Existing `latestarr-data` volumes/appdata work unchanged — this only swaps the image tag.
- `dev` is a working branch, not a release channel — it isn't kept in sync with `main` automatically and can be force-pushed or rebuilt from `main` at any time. Don't point a production instance at `:dev`.
- Switch back to a real release with `LATESTARR_VERSION=latest` (or a pinned `vX.Y.Z`) and pull again.
- **There's no separate changelog for what's on `:dev`** — it's whatever `main` currently has, unreleased. To see what that is: `git log <last-tag>..main --oneline` (or read the pending `.changeset/*.md` files for the polished per-change write-ups already drafted for the eventual release).

## Reporting bugs / requesting features

Use the issue templates (Bug report / Feature request / Adapter request) — they ask for the details needed to reproduce or evaluate the request. Please search existing issues first to avoid duplicates.

Not sure it's a bug, or still shaping an idea? Start a thread in [Discussions](https://github.com/jshields-ca/LatestArr/discussions) instead; it can become an issue once it's concrete. Reports on how a 🧪 source worked on your setup are welcome there too.

Spotted a mistake in the docs at latestarr.app? Open an issue with the `documentation` label, or mention it in Discussions.

## Security issues

Do **not** open a public issue for a security vulnerability — see [`SECURITY.md`](SECURITY.md) for the disclosure process.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you're expected to uphold it.
