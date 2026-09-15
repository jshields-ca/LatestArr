# @latestarr/web

## 0.5.0

### Minor Changes

- d5673c5: Give the Media List builder block real poster/cover-art and metadata (runtime, page count, audiobook duration, platform, rating), expand its content-type picker to all six adapter media kinds (movies, TV episodes, TV seasons, books, audiobooks, games), and add real, non-drag Move up/down buttons to every component's toolbar in the template editor.
- dc52fb4: Add a simple Daily/Weekly/Monthly schedule picker (with a raw-cron "Advanced" fallback) and a timezone selector to the newsletter Add/Edit dialogs, plus a new Edit dialog so a newsletter's schedule, lookback window, subject template, and SMTP profile can be changed after creation without recreating it.

### Patch Changes

- d9b6881: Give each source kind a distinct icon on the Sources page and show its friendly label (e.g. "BookOrbit") instead of the raw adapter id (e.g. "bookorbit").

## 0.4.6

### Patch Changes

- d5a8c93: Add a way to edit your own display name and change your password from the admin UI — previously there was no way to do either without direct database access. A new "Edit profile" button next to the sidebar's user info opens a dialog for both; changing the password requires the current password, and accounts that sign in via SSO (no local password) get a clear error if they try.

## 0.4.5

### Patch Changes

- e7f8671: Polish the sidebar's project links: the "view on GitHub" link now uses an actual GitHub mark instead of a generic folder icon, and the star link is a filled, coloured star instead of an outline in the same muted grey as everything else. The scootr.ca globe icon is replaced with a plain attribution line below ("Jeremy Shields · GPLv3 · scootr.ca"), which also corrects an earlier draft that had mislabeled the project's license as AGPL — LatestArr is GPLv3.

## 0.4.4

### Patch Changes

- 1f54bab: Add the ability to edit an existing Recipient, SMTP Profile, or Source connection instead of having to delete and re-create it to fix a typo or rotate a credential. Recipients gain email editing (previously only display name and active/inactive were editable). Sources gain a `PATCH /api/sources/:id` endpoint (previously the only mutations were create/delete/test). Credential fields on Sources and the username/password on SMTP Profiles are never pre-filled (they're not returned decrypted) — leave them blank to keep the stored value, or fill in every credential field for that source kind to replace them all at once.

## 0.4.3

### Patch Changes

- c547058: Fix SMTP connections silently failing with an OpenSSL "wrong version number" error on providers like Dreamhost. The "Use TLS" toggle defaulted on regardless of port, which makes the mailer attempt implicit TLS (wrapping the socket in TLS immediately) — but port 587 (the form's own default) is a STARTTLS port, which expects a plain connection that upgrades to TLS after the initial handshake, not implicit TLS. Sending an implicit-TLS handshake to a STARTTLS-only port fails immediately. The toggle (relabeled "Use implicit TLS (port 465)") now defaults based on the port entered and only overrides that guess once changed manually, and the mailer now sets `requireTLS` when not using implicit TLS so a STARTTLS upgrade failure surfaces as a clear error instead of silently falling back to an unencrypted connection.

  Also fix the Docker container/project name inheriting whatever directory `docker-compose.yml` happens to live in (e.g. `test-latestarr-latestarr-1`) — `docker-compose.yml` now pins its own project and container name to `latestarr` regardless of the checkout's folder name.

## 0.4.2

No changes in this release.

## 0.4.1

No changes in this release.

## 0.4.0

### Minor Changes

- 6c2f604: Make the GrapesJS template builder keyboard-operable. Previously the block panel, layer manager, and every other builder panel button were unreachable by Tab (GrapesJS renders them as plain `<span>`s with no tabindex), and blocks could only be added by dragging — a keyboard-only user had no way to open the builder's panels or add a block to a newsletter layout at all. Panel buttons and blocks are now focusable and Enter/Space-activatable, and every block gets a non-drag "click to add" fallback (appends to the end of the canvas), matching what GrapesJS's own docs recommend for this exact gap.
- a097e99: Add an unauthenticated `GET /api/version` endpoint, and show the running version plus links to the GitHub repo (view + star) and the author's site in the admin sidebar. Also make the docker-compose host port configurable via a `PORT` env var, for anyone whose default `3000` collides with another running service.

## 0.3.0

### Minor Changes

- 69c5e61: Replace the placeholder dashboard with a real setup checklist (connect a source, add recipients/a group, configure SMTP, optionally build a template, create a newsletter), live stats, and recent send history once setup is complete. Added a `docker-compose.yml` and `.env.example` so self-hosters have an actual quick start instead of a bare Dockerfile.

## 0.2.0

### Minor Changes

- 05c9f01: Rebrand from the original teal/cyan accent to "Bloom," a rose accent chosen to stand apart from the blue/teal/purple already common across the self-hosted media ecosystem (and from Plex's own orange). Along with it:

  - The light theme's neutrals move from stark white to a warm, rose-tinted scale, with a softer tinted shadow replacing the previous flat `shadow-sm` on every card, and a hover lift + shadow on primary buttons.
  - Status badges gain an opt-in `dot` prop (a small pulsing indicator, respecting `prefers-reduced-motion`) — used on the Sources screen's "Connected" status, the one genuinely live indicator in the app.
  - The logo mark changes from a double-chevron to an envelope with a spark, reading as "a newsletter just arrived" rather than a generic up-trend glyph.
  - The "LatestArr" wordmark specifically now renders in Newsreader, a serif built for reading/publication contexts, while every other heading and all body/UI text stays on the default sans stack.

- 77623d0: Add the Tailwind v4 + Radix + shadcn-style design system foundation for the admin WebUI: dark-mode-first theme with a teal/cyan brand accent and light-mode toggle, an original logo/favicon, base components (Button, Card, Switch, Input, Label, Separator, Sheet), a reusable settings-row pattern for clear control/label relationships, and a responsive app shell (sidebar nav on desktop, hamburger drawer on mobile) replacing the placeholder UI.
- f253894: Add the admin WebUI's authentication flow: a first-run setup screen to create the initial admin account, a login page (local credentials, plus a "Continue with SSO" option when OIDC is configured), session-aware route protection that redirects unauthenticated visitors to sign in, and a logout control. Adds a small `GET /auth/providers` endpoint so the frontend can detect whether OIDC is enabled and whether the initial admin account has been created yet.
- a55c7cf: Add the drag-and-drop newsletter builder: a GrapesJS-based editor (`/templates/:id/edit`, code-split so its ~700kB isn't shipped to every page) with a curated MJML block set plus a custom block library — Header, Footer, and a dynamic Media List block. Media List is the one genuinely dynamic block: a user configures it entirely through three Traits (Content type, Sort, Count) with no HTML/CSS knowledge required, and it exports as a `{{#mediaList ...}}` Handlebars block helper that the server's render pipeline resolves against real item data at send time — including a "most watched" sort backed by the Tautulli `fetchPopularItems` capability added in an earlier release. The Template API now accepts `compiledMjml` on create/update so the builder's export can be persisted alongside the reusable `designJson` project data.
- 4e26ca7: Add the Newsletters admin screen: create newsletters, toggle enabled, link/unlink sources and recipient groups, trigger a manual send, and view send history — the last of the four Phase 3 admin CRUD screens.
- d19e9e9: Add the Recipients admin screen: manage recipients (add, toggle active/inactive, delete) and recipient groups (add, delete, and manage membership by adding/removing existing recipients), wired to the existing /recipients and /recipient-groups API.
- dbe0fc8: Add the SMTP profiles admin screen: add a profile, test its connection, send a test email, and delete it, wired to the existing /smtp-profiles API.
- d1f0de8: The Sources admin screen no longer hardcodes "Tautulli" as the only connectable source type. It now fetches the list of registered adapter kinds from a new `GET /sources/kinds` endpoint and lets users pick any of them (Tautulli, Plex, BookLore, BookOrbit, Grimmory, Audiobookshelf, RomM), showing the right credential fields (API key, token, or OPDS username/password) for whichever kind is selected.
- 52a8f0c: Add the Sources admin screen: list connections with their status, add a new Tautulli source, test a connection, and delete a source — the first of the Phase 3 admin CRUD screens.
- f90146b: Add a Templates admin screen (list, create, delete) backed by the existing Template CRUD API. Each template shows whether it's been through the drag-and-drop builder yet ("Designed" vs "Not yet designed") — the builder itself, and editing a template's design, lands in a later PR.
- 2b58d0c: Wire newsletters to templates: the Newsletters admin screen now has a Template picker (set at creation, or changed/unset on an existing newsletter) with a direct link into the GrapesJS builder for the linked template. The Newsletter CRUD API accepts `templateId` on create and update (including explicit `null` to unlink). This completes the newsletter builder feature end-to-end — a newsletter can now actually use a custom-designed template for its sends.

### Patch Changes

- c9d59fc: Wire `jest-axe` into the test suite and add automated accessibility checks against every admin page's list, empty, and dialog states, plus Login, Setup, and Dashboard. This caught a real, app-wide issue: `CardTitle` rendered as `<h3>` while every page places it directly under its own `<h1>` with no `<h2>` in between, skipping a heading level. Fixed by rendering `CardTitle` as `<h2>`, which is correct everywhere it's used (a page nesting it under its own `<h2>` section heading just ends up with sibling `<h2>`s, which is still valid).
- 646d74b: Serve the built admin WebUI directly from apps/server in production, so the Docker image is usable end-to-end instead of API-only. Every backend route now lives under `/api` so it can never collide with a client-side route of the same name (e.g. `/sources` the admin page vs. `/sources` the endpoint) now that both are served from one origin.
