# Changelog

All notable changes to LatestArr are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).
While the major version is `0`, breaking changes may still land in minor
releases — see semver's own note on initial development for what `0.x`
means in practice.

Releases are cut with [Changesets](https://github.com/changesets/changesets);
see `CONTRIBUTING.md` for how to add a changeset to a PR.

## [0.3.0] - 2026-09-14

- Replace the placeholder dashboard with a real setup checklist (connect a source, add recipients/a group, configure SMTP, optionally build a template, create a newsletter), live stats, and recent send history once setup is complete. Added a `docker-compose.yml` and `.env.example` so self-hosters have an actual quick start instead of a bare Dockerfile.

## [0.2.0] - 2026-09-14

- Wire `jest-axe` into the test suite and add automated accessibility checks against every admin page's list, empty, and dialog states, plus Login, Setup, and Dashboard. This caught a real, app-wide issue: `CardTitle` rendered as `<h3>` while every page places it directly under its own `<h1>` with no `<h2>` in between, skipping a heading level. Fixed by rendering `CardTitle` as `<h2>`, which is correct everywhere it's used (a page nesting it under its own `<h2>` section heading just ends up with sibling `<h2>`s, which is still valid).
- Add an Audiobookshelf adapter (`@latestarr/adapter-audiobookshelf`) for connecting audiobook/podcast libraries — authenticates with a bearer token against Audiobookshelf's documented REST API, listing libraries and their recently-added items. Unlike Tautulli/Plex/BookLore, Audiobookshelf has no cross-library "recent items" endpoint, so when no specific libraries are selected the adapter discovers all libraries first and queries each one.
- Rebrand from the original teal/cyan accent to "Bloom," a rose accent chosen to stand apart from the blue/teal/purple already common across the self-hosted media ecosystem (and from Plex's own orange). Along with it: - The light theme's neutrals move from stark white to a warm, rose-tinted scale, with a softer tinted shadow replacing the previous flat `shadow-sm` on every card, and a hover lift + shadow on primary buttons. - Status badges gain an opt-in `dot` prop (a small pulsing indicator, respecting `prefers-reduced-motion`) — used on the Sources screen's "Connected" status, the one genuinely live indicator in the app. - The logo mark changes from a double-chevron to an envelope with a spark, reading as "a newsletter just arrived" rather than a generic up-trend glyph. - The "LatestArr" wordmark specifically now renders in Newsreader, a serif built for reading/publication contexts, while every other heading and all body/UI text stays on the default sans stack.
- Add a BookLore-family adapter (`@latestarr/adapter-booklore-family`) covering BookLore and its compatible forks BookOrbit and Grimmory. These expose their library through OPDS (a standardized Atom-based catalog format, HTTP Basic Auth) rather than a stable internal REST API, so this adapter parses OPDS feeds directly. Since all three forks share the same OPDS surface, this ships as a single adapter factory rather than three near-duplicate implementations — `bookloreAdapter`, `bookOrbitAdapter`, and `grimmoryAdapter` differ only in their `kind` identifier.
- Add the Tailwind v4 + Radix + shadcn-style design system foundation for the admin WebUI: dark-mode-first theme with a teal/cyan brand accent and light-mode toggle, an original logo/favicon, base components (Button, Card, Switch, Input, Label, Separator, Sheet), a reusable settings-row pattern for clear control/label relationships, and a responsive app shell (sidebar nav on desktop, hamburger drawer on mobile) replacing the placeholder UI.
- Fix the release workflow's second crash: `changeset version` auto-formats every `CHANGELOG.md` it touches with the project's own Prettier config (`.prettierrc.cjs` exists at the repo root) by shelling out to `pnpm exec prettier`, but `prettier` was never actually installed as a dependency — only its config file existed. Added `prettier` as a root devDependency so that auto-format step, and the config file that's been sitting unused, actually works.
- Fix the release workflow's first real run, which crashed immediately: `changesets/action` unconditionally reads each bumped package's own `CHANGELOG.md` to build the "Version Packages" PR description, but the previous PR disabled per-package changelog generation entirely (`"changelog": false`), so that file never existed and the action threw `ENOENT`. Reverted to Changesets' default per-package changelog generation — those files are internal bookkeeping the action needs, not something a self-hoster needs to read. `scripts/write-changelog.mjs` still writes the single consolidated root `CHANGELOG.md` entry the actual GitHub Release pulls its notes from; nothing about the human-facing changelog changes.
- Add the admin WebUI's authentication flow: a first-run setup screen to create the initial admin account, a login page (local credentials, plus a "Continue with SSO" option when OIDC is configured), session-aware route protection that redirects unauthenticated visitors to sign in, and a logout control. Adds a small `GET /auth/providers` endpoint so the frontend can detect whether OIDC is enabled and whether the initial admin account has been created yet.
- Add the drag-and-drop newsletter builder: a GrapesJS-based editor (`/templates/:id/edit`, code-split so its ~700kB isn't shipped to every page) with a curated MJML block set plus a custom block library — Header, Footer, and a dynamic Media List block. Media List is the one genuinely dynamic block: a user configures it entirely through three Traits (Content type, Sort, Count) with no HTML/CSS knowledge required, and it exports as a `{{#mediaList ...}}` Handlebars block helper that the server's render pipeline resolves against real item data at send time — including a "most watched" sort backed by the Tautulli `fetchPopularItems` capability added in an earlier release. The Template API now accepts `compiledMjml` on create/update so the builder's export can be persisted alongside the reusable `designJson` project data.
- Add an MJML render pipeline: newsletters linked to a template now render via that template's compiled MJML (substituting real item data through the same Handlebars data-binding layer as the built-in starter template, then compiling to safe, Outlook/Gmail-friendly HTML with `mjml`), falling back to the hardcoded starter template when no custom template is linked or it has no compiled MJML yet.
- Add the Newsletters admin screen: create newsletters, toggle enabled, link/unlink sources and recipient groups, trigger a manual send, and view send history — the last of the four Phase 3 admin CRUD screens.
- Add a direct Plex adapter (`@latestarr/adapter-plex`) as an alternative to Tautulli for users who don't run a separate Tautulli instance — connect straight to a Plex Media Server using its own token-based API (`X-Plex-Token`), listing libraries and recently-added movies/TV episodes/seasons the same way the Tautulli adapter does.
- Add the Recipients admin screen: manage recipients (add, toggle active/inactive, delete) and recipient groups (add, delete, and manage membership by adding/removing existing recipients), wired to the existing /recipients and /recipient-groups API.
- Fix a real bug in `.changeset/config.json`: every workspace package is `private: true` (this app isn't published to npm), and Changesets' default `privatePackages.version: false` silently skips versioning any private package — meaning every changeset merged since Phase 3 has bumped nothing, and `pnpm version-packages` has been a silent no-op the entire time despite reporting success. Fixed by setting `privatePackages.version: true`. Also adds the missing release automation: `.github/workflows/release.yml` opens/updates a "Version Packages" PR whenever changesets are pending on `main` (via `changesets/action`), and cuts a git tag + GitHub Release (with notes pulled from `CHANGELOG.md`) on the push that merges it — this app has no npm package to publish, so "release" means a tag and a GitHub Release, not `npm publish`. Changesets' own per-package changelog generation is disabled (`"changelog": false`) in favor of `scripts/write-changelog.mjs`, which writes one consolidated root `CHANGELOG.md` entry instead of scattering a `CHANGELOG.md` across every internal workspace package — this is a single self-hosted app, not a set of independently-consumed libraries.
- Add a RomM adapter (`@latestarr/adapter-romm`) for connecting game ROM libraries — authenticates with a RomM Client API Token (bearer auth) against its documented REST API, listing platforms as libraries and recently-added ROMs. Unlike Audiobookshelf, RomM's rom-listing endpoint accepts a repeatable `platform_ids` filter directly, so a multi-library fetch is a single request rather than a per-library loop.
- Serve the built admin WebUI directly from apps/server in production, so the Docker image is usable end-to-end instead of API-only. Every backend route now lives under `/api` so it can never collide with a client-side route of the same name (e.g. `/sources` the admin page vs. `/sources` the endpoint) now that both are served from one origin.
- Add the SMTP profiles admin screen: add a profile, test its connection, send a test email, and delete it, wired to the existing /smtp-profiles API.
- The Sources admin screen no longer hardcodes "Tautulli" as the only connectable source type. It now fetches the list of registered adapter kinds from a new `GET /sources/kinds` endpoint and lets users pick any of them (Tautulli, Plex, BookLore, BookOrbit, Grimmory, Audiobookshelf, RomM), showing the right credential fields (API key, token, or OPDS username/password) for whichever kind is selected.
- Add the Sources admin screen: list connections with their status, add a new Tautulli source, test a connection, and delete a source — the first of the Phase 3 admin CRUD screens.
- Add an optional `fetchPopularItems` capability to the `SourceAdapter` contract for ranking items by watch activity ("most watched this week") instead of recency, and implement it for Tautulli via `get_home_stats`. This lays the data groundwork for the newsletter builder's "Most Watched" sort option.
- Add the Template CRUD API (create/list/get/update/delete), persisting the drag-and-drop builder's design JSON — a prerequisite for the upcoming GrapesJS builder, which will save to this endpoint.
- Add a Templates admin screen (list, create, delete) backed by the existing Template CRUD API. Each template shows whether it's been through the drag-and-drop builder yet ("Designed" vs "Not yet designed") — the builder itself, and editing a template's design, lands in a later PR.
- Wire newsletters to templates: the Newsletters admin screen now has a Template picker (set at creation, or changed/unset on an existing newsletter) with a direct link into the GrapesJS builder for the linked template. The Newsletter CRUD API accepts `templateId` on create and update (including explicit `null` to unlink). This completes the newsletter builder feature end-to-end — a newsletter can now actually use a custom-designed template for its sends.

## [0.1.0] - 2026-09-13

Initial functional milestone: a complete backend engine with no admin UI
yet. An operator can drive the entire loop through the API — connect a
Tautulli server, add recipients, configure SMTP, and build a newsletter —
and it will actually poll for new content and send a digest email on
schedule.

### Added

- Repo scaffolding: pnpm + Turborepo monorepo, CI (lint/typecheck/build/test,
  Docker build, Docker runtime smoke test), Dependabot, OSS contribution
  docs (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`), issue/PR
  templates.
- `packages/db`: full Drizzle/SQLite schema and migrations for the entire
  data model (users, sessions, source connections, recipients/groups,
  templates, newsletters, send runs, settings).
- `packages/crypto`: AES-256-GCM envelope encryption for credentials at
  rest.
- Local username/password auth (argon2id, server-side sessions) and
  generic OIDC/SSO auth (`openid-client`, PKCE authorization-code flow).
- `packages/adapters/core`: the `SourceAdapter` contract and registry every
  future source integration implements.
- `packages/adapters/tautulli`: the reference adapter implementation,
  proven end-to-end via a SourceConnection CRUD API (create, test
  connection, list libraries, fetch recently-added items).
- Recipients and RecipientGroups CRUD, with group membership management.
- SmtpProfile CRUD and a Nodemailer-based mailer (connection test,
  send-test-email).
- Newsletter CRUD, with source and recipient-group associations.
- A hardcoded Handlebars starter template rendering recently-added items
  into email HTML (the drag-and-drop builder replacing this is planned for
  the next release).
- The send pipeline: fetch recently-added items from every linked source,
  render, resolve recipients, send, and record a `SendRun` /
  `SendRunRecipientResult` per attempt — exposed via a manual
  `POST /newsletters/:id/send-now` trigger and a `GET .../send-runs`
  history endpoint.
- A croner-based scheduler running each newsletter on its own cron
  expression and timezone, refreshed live whenever a newsletter is
  created, updated, or deleted.

[0.1.0]: https://github.com/jshields-ca/latestarr/releases/tag/v0.1.0
