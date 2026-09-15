# @latestarr/server

## 0.6.0

### Minor Changes

- 8b0936e: Fix the "default layout" (no custom template picked) newsletter render falling back to a stale, pre-poster hardcoded template with no images and no MJML compilation. It now renders through the same MJML pipeline as a custom GrapesJS template, so a default-layout send gets the same poster + metadata cards, responsive layout, and Outlook/MSO compatibility.

### Patch Changes

- 12df8b1: Newsletter admin fixes from design review and a real send-now test run: newsletter cards now show a human-readable schedule ("Weekly on Monday at 8:00 AM") instead of the raw cron string for schedules the Simple picker can express; the Add newsletter dialog defaults Timezone to the browser's own zone instead of always UTC, and pre-selects the SMTP profile when there's exactly one; the Add/Edit newsletter dialogs group their Schedule and Delivery fields into labeled sections instead of one flat list; a "Send now" that completes with nothing actually sent (no linked source or recipient group) is now visually distinguished from a real send in Send History and on the Dashboard; a genuine send failure (e.g. an unreachable source) now returns a specific, structured error instead of a bare "Internal Server Error", shown inline the moment the send fails; and Send History now refreshes automatically right after a "Send now" click resolves instead of requiring a page reload.
- @latestarr/adapter-audiobookshelf@0.6.0
  - @latestarr/adapter-booklore-family@0.6.0
  - @latestarr/adapter-core@0.6.0
  - @latestarr/adapter-plex@0.6.0
  - @latestarr/adapter-romm@0.6.0
  - @latestarr/adapter-tautulli@0.6.0
  - @latestarr/crypto@0.6.0
  - @latestarr/db@0.6.0

## 0.5.0

### Minor Changes

- d5673c5: Give the Media List builder block real poster/cover-art and metadata (runtime, page count, audiobook duration, platform, rating), expand its content-type picker to all six adapter media kinds (movies, TV episodes, TV seasons, books, audiobooks, games), and add real, non-drag Move up/down buttons to every component's toolbar in the template editor.

### Patch Changes

- @latestarr/adapter-audiobookshelf@0.5.0
  - @latestarr/adapter-booklore-family@0.5.0
  - @latestarr/adapter-core@0.5.0
  - @latestarr/adapter-plex@0.5.0
  - @latestarr/adapter-romm@0.5.0
  - @latestarr/adapter-tautulli@0.5.0
  - @latestarr/crypto@0.5.0
  - @latestarr/db@0.5.0

## 0.4.6

### Patch Changes

- d5a8c93: Add a way to edit your own display name and change your password from the admin UI — previously there was no way to do either without direct database access. A new "Edit profile" button next to the sidebar's user info opens a dialog for both; changing the password requires the current password, and accounts that sign in via SSO (no local password) get a clear error if they try.
- @latestarr/adapter-audiobookshelf@0.4.6
  - @latestarr/adapter-booklore-family@0.4.6
  - @latestarr/adapter-core@0.4.6
  - @latestarr/adapter-plex@0.4.6
  - @latestarr/adapter-romm@0.4.6
  - @latestarr/adapter-tautulli@0.4.6
  - @latestarr/crypto@0.4.6
  - @latestarr/db@0.4.6

## 0.4.5

### Patch Changes

- @latestarr/adapter-audiobookshelf@0.4.5
  - @latestarr/adapter-booklore-family@0.4.5
  - @latestarr/adapter-core@0.4.5
  - @latestarr/adapter-plex@0.4.5
  - @latestarr/adapter-romm@0.4.5
  - @latestarr/adapter-tautulli@0.4.5
  - @latestarr/crypto@0.4.5
  - @latestarr/db@0.4.5

## 0.4.4

### Patch Changes

- 1f54bab: Add the ability to edit an existing Recipient, SMTP Profile, or Source connection instead of having to delete and re-create it to fix a typo or rotate a credential. Recipients gain email editing (previously only display name and active/inactive were editable). Sources gain a `PATCH /api/sources/:id` endpoint (previously the only mutations were create/delete/test). Credential fields on Sources and the username/password on SMTP Profiles are never pre-filled (they're not returned decrypted) — leave them blank to keep the stored value, or fill in every credential field for that source kind to replace them all at once.
- @latestarr/adapter-audiobookshelf@0.4.4
  - @latestarr/adapter-booklore-family@0.4.4
  - @latestarr/adapter-core@0.4.4
  - @latestarr/adapter-plex@0.4.4
  - @latestarr/adapter-romm@0.4.4
  - @latestarr/adapter-tautulli@0.4.4
  - @latestarr/crypto@0.4.4
  - @latestarr/db@0.4.4

## 0.4.3

### Patch Changes

- c547058: Fix SMTP connections silently failing with an OpenSSL "wrong version number" error on providers like Dreamhost. The "Use TLS" toggle defaulted on regardless of port, which makes the mailer attempt implicit TLS (wrapping the socket in TLS immediately) — but port 587 (the form's own default) is a STARTTLS port, which expects a plain connection that upgrades to TLS after the initial handshake, not implicit TLS. Sending an implicit-TLS handshake to a STARTTLS-only port fails immediately. The toggle (relabeled "Use implicit TLS (port 465)") now defaults based on the port entered and only overrides that guess once changed manually, and the mailer now sets `requireTLS` when not using implicit TLS so a STARTTLS upgrade failure surfaces as a clear error instead of silently falling back to an unencrypted connection.

  Also fix the Docker container/project name inheriting whatever directory `docker-compose.yml` happens to live in (e.g. `test-latestarr-latestarr-1`) — `docker-compose.yml` now pins its own project and container name to `latestarr` regardless of the checkout's folder name.

- @latestarr/adapter-audiobookshelf@0.4.3
  - @latestarr/adapter-booklore-family@0.4.3
  - @latestarr/adapter-core@0.4.3
  - @latestarr/adapter-plex@0.4.3
  - @latestarr/adapter-romm@0.4.3
  - @latestarr/adapter-tautulli@0.4.3
  - @latestarr/crypto@0.4.3
  - @latestarr/db@0.4.3

## 0.4.2

### Patch Changes

- 80d7e1c: Fix login silently failing (redirects to the dashboard, then immediately shows "Not authenticated", every time, even right after refresh) when accessing the app directly over plain HTTP without a reverse proxy in front — again, exactly the documented default Getting Started flow. The session cookie's `Secure` flag was set based on `NODE_ENV === "production"`, but the Docker image always sets `NODE_ENV=production` regardless of whether TLS is actually in front of the app, so `Secure` was forced on unconditionally; browsers silently refuse to store a `Secure` cookie over a plain HTTP connection, so the cookie set by `/api/auth/login` was simply never kept. `Secure` is now based on the actual request protocol instead, which is `http` unless a reverse proxy is explicitly trusted via the new `TRUST_PROXY=true` env var and forwards `X-Forwarded-Proto: https` (documented in `docs/self-hosting.md`'s reverse-proxy section, which already described this as the intended mechanism).
- @latestarr/adapter-audiobookshelf@0.4.2
  - @latestarr/adapter-booklore-family@0.4.2
  - @latestarr/adapter-core@0.4.2
  - @latestarr/adapter-plex@0.4.2
  - @latestarr/adapter-romm@0.4.2
  - @latestarr/adapter-tautulli@0.4.2
  - @latestarr/crypto@0.4.2
  - @latestarr/db@0.4.2

## 0.4.1

### Patch Changes

- a052e46: Fix the admin UI failing to load entirely (blank page) when accessed directly over plain HTTP without a reverse proxy in front. `@fastify/helmet`'s Content-Security-Policy defaults silently include `upgrade-insecure-requests`, which tells the browser to rewrite every `http://` subresource request (the JS bundle, CSS, favicon) to `https://` before sending it — independent of any browser "HTTPS-Only Mode" setting, and unaffected by exceptions or private browsing. Since LatestArr has no TLS listener of its own (TLS is expected to come from a reverse proxy), those upgraded requests failed outright and the app never rendered. The directive is now explicitly removed from the CSP.
- @latestarr/adapter-audiobookshelf@0.4.1
  - @latestarr/adapter-booklore-family@0.4.1
  - @latestarr/adapter-core@0.4.1
  - @latestarr/adapter-plex@0.4.1
  - @latestarr/adapter-romm@0.4.1
  - @latestarr/adapter-tautulli@0.4.1
  - @latestarr/crypto@0.4.1
  - @latestarr/db@0.4.1

## 0.4.0

### Minor Changes

- 2037414: Catch up newsletters whose scheduled send was missed while the process was down. On boot, the scheduler now checks each enabled newsletter's last actual send (or creation time, if it's never sent) against its cron schedule, and runs it once if a scheduled fire was missed — previously a missed occurrence during downtime just silently never happened.
- 04b0293: Add security headers (`@fastify/helmet`, with a CSP tuned for the GrapesJS builder and Google Fonts), rate limiting (`@fastify/rate-limit`, generous global default plus a strict 10/minute cap on login and bootstrap), and CSRF protection via a same-origin check on every mutating request.
- a097e99: Add an unauthenticated `GET /api/version` endpoint, and show the running version plus links to the GitHub repo (view + star) and the author's site in the admin sidebar. Also make the docker-compose host port configurable via a `PORT` env var, for anyone whose default `3000` collides with another running service.
- a04bea7: Validate every request body with zod (sources, recipients, recipient groups, SMTP profiles, newsletters, templates, auth) instead of ad-hoc `if (!field)` checks. Malformed types (a string where a number is expected, an object where an array is expected) are now rejected with a 400 instead of reaching the database layer.

### Patch Changes

- b1b2130: Publish a container image to `ghcr.io/jshields-ca/latestarr` on every tagged release (`:latest` and `:vX.Y.Z`), so self-hosters can `docker compose pull` instead of always building from source. `docker-compose.yml` now references that image, falling back to building from `docker/Dockerfile` when no matching image exists locally.
- @latestarr/adapter-audiobookshelf@0.4.0
  - @latestarr/adapter-booklore-family@0.4.0
  - @latestarr/adapter-core@0.4.0
  - @latestarr/adapter-plex@0.4.0
  - @latestarr/adapter-romm@0.4.0
  - @latestarr/adapter-tautulli@0.4.0
  - @latestarr/crypto@0.4.0
  - @latestarr/db@0.4.0

## 0.3.0

### Patch Changes

- @latestarr/adapter-audiobookshelf@0.3.0
  - @latestarr/adapter-booklore-family@0.3.0
  - @latestarr/adapter-core@0.3.0
  - @latestarr/adapter-plex@0.3.0
  - @latestarr/adapter-romm@0.3.0
  - @latestarr/adapter-tautulli@0.3.0
  - @latestarr/crypto@0.3.0
  - @latestarr/db@0.3.0

## 0.2.0

### Minor Changes

- 6c9dbfa: Add an Audiobookshelf adapter (`@latestarr/adapter-audiobookshelf`) for connecting audiobook/podcast libraries — authenticates with a bearer token against Audiobookshelf's documented REST API, listing libraries and their recently-added items. Unlike Tautulli/Plex/BookLore, Audiobookshelf has no cross-library "recent items" endpoint, so when no specific libraries are selected the adapter discovers all libraries first and queries each one.
- 20b13fd: Add a BookLore-family adapter (`@latestarr/adapter-booklore-family`) covering BookLore and its compatible forks BookOrbit and Grimmory. These expose their library through OPDS (a standardized Atom-based catalog format, HTTP Basic Auth) rather than a stable internal REST API, so this adapter parses OPDS feeds directly. Since all three forks share the same OPDS surface, this ships as a single adapter factory rather than three near-duplicate implementations — `bookloreAdapter`, `bookOrbitAdapter`, and `grimmoryAdapter` differ only in their `kind` identifier.
- f253894: Add the admin WebUI's authentication flow: a first-run setup screen to create the initial admin account, a login page (local credentials, plus a "Continue with SSO" option when OIDC is configured), session-aware route protection that redirects unauthenticated visitors to sign in, and a logout control. Adds a small `GET /auth/providers` endpoint so the frontend can detect whether OIDC is enabled and whether the initial admin account has been created yet.
- a55c7cf: Add the drag-and-drop newsletter builder: a GrapesJS-based editor (`/templates/:id/edit`, code-split so its ~700kB isn't shipped to every page) with a curated MJML block set plus a custom block library — Header, Footer, and a dynamic Media List block. Media List is the one genuinely dynamic block: a user configures it entirely through three Traits (Content type, Sort, Count) with no HTML/CSS knowledge required, and it exports as a `{{#mediaList ...}}` Handlebars block helper that the server's render pipeline resolves against real item data at send time — including a "most watched" sort backed by the Tautulli `fetchPopularItems` capability added in an earlier release. The Template API now accepts `compiledMjml` on create/update so the builder's export can be persisted alongside the reusable `designJson` project data.
- 1194bec: Add an MJML render pipeline: newsletters linked to a template now render via that template's compiled MJML (substituting real item data through the same Handlebars data-binding layer as the built-in starter template, then compiling to safe, Outlook/Gmail-friendly HTML with `mjml`), falling back to the hardcoded starter template when no custom template is linked or it has no compiled MJML yet.
- ac35fc1: Add a direct Plex adapter (`@latestarr/adapter-plex`) as an alternative to Tautulli for users who don't run a separate Tautulli instance — connect straight to a Plex Media Server using its own token-based API (`X-Plex-Token`), listing libraries and recently-added movies/TV episodes/seasons the same way the Tautulli adapter does.
- 10830fa: Add a RomM adapter (`@latestarr/adapter-romm`) for connecting game ROM libraries — authenticates with a RomM Client API Token (bearer auth) against its documented REST API, listing platforms as libraries and recently-added ROMs. Unlike Audiobookshelf, RomM's rom-listing endpoint accepts a repeatable `platform_ids` filter directly, so a multi-library fetch is a single request rather than a per-library loop.
- 646d74b: Serve the built admin WebUI directly from apps/server in production, so the Docker image is usable end-to-end instead of API-only. Every backend route now lives under `/api` so it can never collide with a client-side route of the same name (e.g. `/sources` the admin page vs. `/sources` the endpoint) now that both are served from one origin.
- d1f0de8: The Sources admin screen no longer hardcodes "Tautulli" as the only connectable source type. It now fetches the list of registered adapter kinds from a new `GET /sources/kinds` endpoint and lets users pick any of them (Tautulli, Plex, BookLore, BookOrbit, Grimmory, Audiobookshelf, RomM), showing the right credential fields (API key, token, or OPDS username/password) for whichever kind is selected.
- f576990: Add the Template CRUD API (create/list/get/update/delete), persisting the drag-and-drop builder's design JSON — a prerequisite for the upcoming GrapesJS builder, which will save to this endpoint.
- 2b58d0c: Wire newsletters to templates: the Newsletters admin screen now has a Template picker (set at creation, or changed/unset on an existing newsletter) with a direct link into the GrapesJS builder for the linked template. The Newsletter CRUD API accepts `templateId` on create and update (including explicit `null` to unlink). This completes the newsletter builder feature end-to-end — a newsletter can now actually use a custom-designed template for its sends.

### Patch Changes

- bc683eb: Fix the release workflow's second crash: `changeset version` auto-formats every `CHANGELOG.md` it touches with the project's own Prettier config (`.prettierrc.cjs` exists at the repo root) by shelling out to `pnpm exec prettier`, but `prettier` was never actually installed as a dependency — only its config file existed. Added `prettier` as a root devDependency so that auto-format step, and the config file that's been sitting unused, actually works.
- a4c79b7: Fix the release workflow's first real run, which crashed immediately: `changesets/action` unconditionally reads each bumped package's own `CHANGELOG.md` to build the "Version Packages" PR description, but the previous PR disabled per-package changelog generation entirely (`"changelog": false`), so that file never existed and the action threw `ENOENT`. Reverted to Changesets' default per-package changelog generation — those files are internal bookkeeping the action needs, not something a self-hoster needs to read. `scripts/write-changelog.mjs` still writes the single consolidated root `CHANGELOG.md` entry the actual GitHub Release pulls its notes from; nothing about the human-facing changelog changes.
- 66c45b5: Fix a real bug in `.changeset/config.json`: every workspace package is `private: true` (this app isn't published to npm), and Changesets' default `privatePackages.version: false` silently skips versioning any private package — meaning every changeset merged since Phase 3 has bumped nothing, and `pnpm version-packages` has been a silent no-op the entire time despite reporting success. Fixed by setting `privatePackages.version: true`.

  Also adds the missing release automation: `.github/workflows/release.yml` opens/updates a "Version Packages" PR whenever changesets are pending on `main` (via `changesets/action`), and cuts a git tag + GitHub Release (with notes pulled from `CHANGELOG.md`) on the push that merges it — this app has no npm package to publish, so "release" means a tag and a GitHub Release, not `npm publish`. Changesets' own per-package changelog generation is disabled (`"changelog": false`) in favor of `scripts/write-changelog.mjs`, which writes one consolidated root `CHANGELOG.md` entry instead of scattering a `CHANGELOG.md` across every internal workspace package — this is a single self-hosted app, not a set of independently-consumed libraries.

- Updated dependencies [6c9dbfa]
- Updated dependencies [20b13fd]
- Updated dependencies [ac35fc1]
- Updated dependencies [10830fa]
- Updated dependencies [dc5a521]
  - @latestarr/adapter-audiobookshelf@0.2.0
  - @latestarr/adapter-booklore-family@0.2.0
  - @latestarr/adapter-plex@0.2.0
  - @latestarr/adapter-romm@0.2.0
  - @latestarr/adapter-core@0.2.0
  - @latestarr/adapter-tautulli@0.2.0
  - @latestarr/crypto@0.2.0
  - @latestarr/db@0.2.0
