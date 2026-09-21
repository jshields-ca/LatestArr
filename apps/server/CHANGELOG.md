# @latestarr/server

## 0.9.0

### Minor Changes

- 0e4c89a: **New:** Newsletter items are now clickable — a movie, show, book, audiobook, or game in a sent newsletter links straight to that item on its source (Plex, Tautulli, Audiobookshelf, RomM, or a BookLore-family reader), instead of being plain unlinked text.

  <details>
  <summary>Technical details</summary>

  Two gaps combined to make nothing in a sent newsletter clickable before this: `sourceConnections` had only one URL column (`baseUrl`), used both for an adapter's own API calls and as the one place a link was ever rendered (the Media List block's `emptyFallback="link"` fallback) — which breaks for Tautulli (`baseUrl` is the Tautulli API host, not a Plex-watchable URL) and for a source whose `baseUrl` is a Tailscale/LAN address unreachable by an email recipient. And `NewItem.externalUrl` (`packages/adapters/core/src/source-adapter.ts`), though already threaded through the render pipeline (`RenderableItem.externalUrl` in `apps/server/src/render/mjml-template.ts`), was never actually set by any adapter.

  Adds an optional `publicUrl` column to `source_connections` (`packages/db/src/schema.ts`, migration `packages/db/drizzle/0001_nostalgic_ulik.sql`, generated with `drizzle-kit generate`) — the address a recipient can actually reach, falling back to `baseUrl` when unset so every existing source connection keeps behaving exactly as it does today. Threaded through `SourceConnectionConfig` (`packages/adapters/core/src/source-adapter.ts`) and the Sources API (`apps/server/src/http/routes/sources.ts`, validated as a URL when present, or an empty string to clear it).

  Every adapter now builds a real per-item deep link where the source's URL scheme supports it:
  - **Plex**: `{publicUrl}/web/index.html#!/server/{machineIdentifier}/details?key=%2Flibrary%2Fmetadata%2F{ratingKey}` — fetches the server's `machineIdentifier` from `/identity` (new `getServerIdentity` in `plex-client.ts`) once per fetch, falling back to a plain library link if that lookup fails. An unset `publicUrl` falls back to building the same link from `baseUrl`, matching today's behavior for a fully-public single-Plex setup.
  - **Tautulli**: the same Plex web deep-link format, built from Tautulli's own `get_server_id` API (proxying the underlying Plex server's `machineIdentifier`) and `rating_key` — shares `buildPlexWebDeepLink` with the Plex adapter (new export in `packages/adapters/core/src/url-utils.ts`). Unlike every other adapter here, an unset `publicUrl` means **no** `externalUrl` is set at all (not a `baseUrl` fallback) — Tautulli's own `baseUrl` is its API host, never a page a recipient should be sent to, so building a link from it would produce a plausible-looking link to a page that doesn't exist there; this exactly matches Tautulli-linked items' behavior before this release (no link) rather than introducing a new broken one. The `get_server_id` lookup itself is skipped entirely (not just its result discarded) when there's no `publicUrl` to build a link from, so a Tautulli connection with no `publicUrl` set makes no additional API calls at all.
  - **BookLore family** (BookLore/BookOrbit/Grimmory): reads an OPDS entry's own `rel="alternate"`/`rel="self"` link (new `getEntryPermalinkHref` in `booklore-client.ts`) and rebases it onto `publicUrl`'s origin (new `withOrigin` helper) instead of the internal host the feed itself was served from — but only when the permalink resolves to `baseUrl`'s own origin; a permalink that already points at a genuinely different, distinct host (some catalogs point `rel="alternate"` at a publisher/mirror page) is left untouched instead of being force-rebased into a broken URL. Falls back to the library root when an entry carries no usable permalink at all. An entry's OPDS `<link>` is untrusted content from the source server itself, so its scheme is validated (`isHttpUrl`, new export alongside `withOrigin`) before ever being used — a `javascript:`/`data:` href is treated as "no usable permalink" rather than reaching a sent email's `<a href>` (Handlebars' default `{{}}` escaping used to render `{{externalUrl}}` guards markup characters, not URL schemes, so nothing downstream would otherwise have caught this). An unset `publicUrl` falls back to `baseUrl`.
  - **Audiobookshelf**: `{publicUrl}/item/{itemId}`, falling back to `baseUrl` when unset.
  - **RomM**: `{publicUrl}/rom/{id}`, falling back to `baseUrl` when unset.

  The Sources API's `publicUrl` field is itself restricted to `http`/`https` (`apps/server/src/http/routes/sources.ts`), for the same reason: it flows straight into every adapter's link construction.

  The default (non-custom-template) newsletter layout (`apps/server/src/render/newsletter-template.ts`) now wraps an item's title and poster in `<a href="{{externalUrl}}">` when present, styled to inherit the surrounding text color with no underline so a linked title doesn't read differently from an unlinked one; falls back to plain text/image otherwise. The Media List block's `emptyFallback="link"` "browse the library" link (`apps/server/src/pipeline/run-newsletter.ts`'s `buildSourceLinksByContentType`, consumed by `mjml-template.ts`) now prefers `publicUrl` over `baseUrl` too.

  </details>

### Patch Changes

- 9dcab81: **Fixed:** Every item in a sent newsletter now shows a small badge naming what it is — "Movie", "TV Episode", "TV Season", "Game", "Book", or "Audiobook". Previously only Ebooks, Comics, Audiobooks and Podcasts (from BookLore-family and Audiobookshelf) got a badge; movies, TV episodes, TV seasons and games showed no badge at all.

  <details>
  <summary>Technical details</summary>

  The badge markup in both the default template (`apps/server/src/render/newsletter-template.ts`) and the GrapesJS-authored one (`apps/web/src/lib/grapesjs-blocks.ts`'s `CONTENT_LABEL_BADGE`) has always rendered `{{contentLabel}}`, an optional, adapter-set free-text field on `NewItem` — only BookLore-family and Audiobookshelf ever set it (to distinguish Ebook/Comic within "book" or Audiobook/Podcast within "audiobook"). The `kind` field itself (movie/tv_episode/tv_season/book/audiobook/game) was never mapped to a display label anywhere in the render path.

  Rather than duplicating a label map in both consumers, the fallback is resolved once, upstream of both: `apps/server/src/render/mjml-template.ts`'s `toRenderable()` (the single function both the default and custom/GrapesJS-authored templates' items pass through before either ever sees them) now resolves `contentLabel` via a new `KIND_LABELS` map when the adapter didn't set one, so `RenderableItem.contentLabel` is always populated. Both templates already just read `{{contentLabel}}`, so neither needed any change — `grapesjs-blocks.ts`'s badge markup works unmodified. An adapter-set `contentLabel` (Comic, Podcast, etc.) still takes priority over the kind fallback.

  </details>

- 9dcab81: **Improved:** The default newsletter layout now opens with a short line under the title ("Here's what's new in the last 7 days.", using your newsletter's own lookback setting) and its footer now links to LatestArr's GitHub repo and to where you can report an issue.

  <details>
  <summary>Technical details</summary>

  Both changes are in the default MJML template (`apps/server/src/render/newsletter-template.ts`), the layout a newsletter falls back to when no custom template is picked.

  Intro line: `NewsletterRenderContext` and `MjmlRenderContext` (`apps/server/src/render/mjml-template.ts`) both gained an optional `lookbackDays?: number`, threaded from `newsletter.lookbackDays` (`packages/db/src/schema.ts`) through `renderNewsletterContent` in `apps/server/src/pipeline/run-newsletter.ts`'s call to `renderDefaultNewsletterHtml`, and bound as `{{lookbackDays}}` in the Handlebars data `renderMjmlTemplate` passes to `Handlebars.compile`. Guarded by `{{#if lookbackDays}}` so the line is simply omitted for a caller that doesn't pass it (e.g. existing tests). A custom, GrapesJS-authored template has no built-in use for this today, but can reference `{{lookbackDays}}` directly since it's now part of the general render context.

  Footer links: two plain `<a>` tags added inside the existing footer `<mj-text>`, pointing at `https://github.com/jshields-ca/LatestArr` and `https://github.com/jshields-ca/LatestArr/issues`, styled inline to match the existing muted footer text (no external CSS, consistent with the rest of this template's email-safe conventions).

  </details>

- 9dcab81: **Fixed:** A newly added TV season now shows the show's name (e.g. "Breaking Bad") as its title, with the season itself (e.g. "Season 1") as the subtitle — previously it just showed "Season 1" with no indication of which show it belonged to, the same problem episodes had before an earlier fix.

  <details>
  <summary>Technical details</summary>

  Both `packages/adapters/plex/src/plex-adapter.ts` and `packages/adapters/tautulli/src/tautulli-adapter.ts` already had this fix for `tv_episode` items (promoting the show name from `grandparentTitle`/`grandparent_title` into the primary title, demoting the episode's own name to the subtitle via `buildEpisodeTitle`/`buildEpisodeSubtitle`), but had no equivalent for `tv_season` items.

  Added mirrored `buildSeasonTitle`/`buildSeasonSubtitle` helpers to both adapters. Plex's `PlexMetadataItem` already declared `parentTitle` (the direct-parent show name, one level up from a season — not `grandparentTitle`, which is two levels up and only populated for episodes) but it was never read; it's now used the same way `grandparentTitle` is for episodes. Tautulli's `TautulliRecentlyAddedItem` had no equivalent field, so a `parent_title?: string` field was added to it (mirroring the existing `grandparent_title`/`parent_media_index` fields already proxied through from the underlying Plex server).

  Both fixes fall back to the season's own bare title with no subtitle when the parent-title field is absent, matching the existing defensive pattern for episodes without a `grandparentTitle`/`grandparent_title`. Test cases covering both the happy path and the fallback were added to `plex-adapter.test.ts` and `tautulli-adapter.test.ts`.

  </details>

- @latestarr/adapter-audiobookshelf@0.9.0
  - @latestarr/adapter-booklore-family@0.9.0
  - @latestarr/adapter-core@0.9.0
  - @latestarr/adapter-plex@0.9.0
  - @latestarr/adapter-romm@0.9.0
  - @latestarr/adapter-tautulli@0.9.0
  - @latestarr/crypto@0.9.0
  - @latestarr/db@0.9.0

## 0.8.0

### Patch Changes

- @latestarr/adapter-audiobookshelf@0.8.0
  - @latestarr/adapter-booklore-family@0.8.0
  - @latestarr/adapter-core@0.8.0
  - @latestarr/adapter-plex@0.8.0
  - @latestarr/adapter-romm@0.8.0
  - @latestarr/adapter-tautulli@0.8.0
  - @latestarr/crypto@0.8.0
  - @latestarr/db@0.8.0

## 0.7.1

### Patch Changes

- e65d4c3: Bump croner (9 → 10), the scheduler library. Runtime dependency — this is the highest-risk bump in the deferred major-version pass, since a subtle regression here could silently stop newsletters from firing on schedule rather than failing loudly.

  Extra scrutiny beyond the usual test suite, since `apps/server/src/scheduler/engine.ts`'s missed-schedule catch-up logic (`nextScheduledRunAfter`) always constructs a real `Cron` directly — it isn't behind the tests' injectable `cronFactory` mock, so `apps/server/src/scheduler/engine.test.ts`'s catch-up tests already exercise real croner behavior at exact date boundaries, not a stub:

  - All 11 scheduler tests pass unchanged, including the three missed-schedule catch-up boundary cases.
  - Directly verified `nextRun(since)` is still strictly-after-exclusive of `since` (matching the code's own documented assumption) at the exact same boundary the tests use (`"0 9 * * 1"` around `2024-01-01T09:00:00Z`).
  - Directly verified the exact 3-arg `new Cron(pattern, options, callback)` constructor shape `defaultCronFactory` depends on, plus `.stop()`, still work unchanged.

  `pnpm turbo run lint typecheck build test` is fully green (40/40 tasks).

- 51311b4: Bump eslint (9 → 10) and @eslint/js (9 → 10) across every package, and jsdom (25 → 29.1.1) in apps/web's test environment. Dev-tooling only, no runtime dependency changes.

  The Dependabot PRs for eslint/@eslint/js (#97, #105) failed CI with a stale, out-of-sync pnpm-lock.yaml on their branch — reproduced locally with a freshly regenerated lockfile and confirmed all 40 lint/typecheck/build/test tasks pass cleanly; `eslint-plugin-jsx-a11y`'s declared peer range hasn't caught up to eslint 10 yet, but it lints without error in practice.

  jsdom's own Dependabot PR (#104) proposed 25 → 30, but jsdom 30 dropped Node 20 support entirely (`engines: "^22.22.2 || ^24.15.0 || >=26.0.0"`), which broke this repo's Node 20.x CI job with `TypeError: webidl.util.markAsUncloneable is not a function` — a real Node-runtime incompatibility, not a lockfile issue. Landing on 29.1.1 instead (the latest jsdom release that still supports Node 20.19+) gets most of the version currency without dropping Node 20 CI support, which is a bigger call than a routine dependency bump.

- 73a6d37: Bump vite (6 → 8, apps/web only), vitest (4 → 5, every package), and @vitejs/plugin-react (4 → 6, apps/web only). Dev-tooling only, no runtime dependency changes.

  Bumped all three together since they're an interlocking build/test toolchain — vitest 5 pins a vite 6+ peer, and @vitejs/plugin-react needs to track the vite major it's paired with. `pnpm turbo run lint typecheck build test` is fully green (40/40 tasks, 189 server tests, 225 web tests); no config changes needed in `apps/web/vite.config.ts` or any `vitest.config`.

- Updated dependencies [e4532fd]
- Updated dependencies [51311b4]
- Updated dependencies [73a6d37]
  - @latestarr/db@0.7.1
  - @latestarr/crypto@0.7.1
  - @latestarr/adapter-core@0.7.1
  - @latestarr/adapter-plex@0.7.1
  - @latestarr/adapter-tautulli@0.7.1
  - @latestarr/adapter-audiobookshelf@0.7.1
  - @latestarr/adapter-booklore-family@0.7.1
  - @latestarr/adapter-romm@0.7.1

## 0.7.0

### Patch Changes

- f18f469: Addresses the most common piece of v0.6.0 production feedback: newsletters rendering "very plain, no images/posters/covers." Only the RomM adapter ever populated `posterUrl` — Plex, Tautulli, Audiobookshelf, and the BookLore family all left it empty, so their items never got a poster in the default template or a Media List block, even though the rendering side already supported one.

  Wires poster/cover art through for all four remaining adapters: Plex maps its `thumb` field to a token-bearing absolute URL; Tautulli adds the `thumb`/`art` fields its API was already returning but the client wasn't reading, resolved through its own `pms_image_proxy` command; Audiobookshelf maps `media.coverPath` to its token-bearing cover endpoint; and the BookLore-family client gains real OPDS `<link rel="...image">` parsing (preferring the full image over the thumbnail), which it had none of before.

  Rather than putting a source's own URL (frequently LAN-only, and often carrying that source's credentials as a query param) directly into a sent email, a new pipeline step (`apps/server/src/pipeline/embed-images.ts`) fetches each item's image server-side at send time — using the same stored, decrypted credentials the pipeline already polls that source with, via a new `SourceAdapter.fetchImageBytes()` (replacing the previously unimplemented `resolveImageUrl`) — resizes it to a thumbnail with `sharp`, and attaches it to the outgoing email as a Nodemailer CID attachment. The rendered HTML references it with `<img src="cid:...">`; a recipient's mail client never makes an outbound request of its own. This is applied uniformly to the default template and to the GrapesJS Media List block. Every step fails soft, per item: an unreachable source, a failed fetch, or an image `sharp` can't decode falls back to a small blank-pixel data URI for that one item rather than failing the whole send.

  Embedding only ever happens for images a Media List block's own selection (count/order/showAll/emptyFallback) actually renders — real `posterUrl`s are swapped for opaque placeholder tokens before the template renders, and only the tokens that survive into the compiled HTML get fetched, resized, and attached afterward. Otherwise a block showing 5 items out of an 80-item library would fetch, resize, and attach all 80 posters even though only 5 ever appear in the email, undermining the whole "keep message size sane" point of CID embedding. Referenced images are also fetched/resized concurrently rather than one at a time, and the "most watched" and "empty-pool fallback" item pools are fetched concurrently with each other rather than sequentially. Every adapter's image fetch (`fetchImage`/`fetchOpdsImage`) is also now bounded by a 10s `AbortSignal.timeout()` — since `resolvePosterPlaceholders` awaits every referenced item's image via `Promise.all`, one source that hangs instead of erroring would otherwise stall the whole send indefinitely rather than failing that one item's poster softly.

  Also replaces every adapter client's `baseUrl.replace(/\/+$/, "")` trailing-slash trim with a new shared `trimTrailingSlashes()` helper (`@latestarr/adapter-core`) — a plain linear scan instead of a regex CodeQL flagged as a polynomial-time ("catastrophic backtracking") pattern on uncontrolled input.

  Also, from the same feedback:
  - **TV episode titles**: a `tv_episode` item's prominent title was just the bare episode name (e.g. "Winter Is Coming"), with the series name buried in the subtitle — it now leads with the series title, with "SxxExx - Episode Name" as the subtitle, for both Plex and Tautulli. Rendered items also now show a release date alongside the added date when the source provides one.
  - **Content-kind labeling**: BookLore-family items are now labeled "Ebook", "Comic", or "Book" (derived from the OPDS acquisition link's MIME type), and Audiobookshelf items "Audiobook" or "Podcast", surfaced as a small badge next to the title in both the default template and the Media List block — without widening the shared `MediaKind` enum for it.
  - **Smarter Media List blocks**: a new "Random order" trait picks random items from the matching pool instead of always the first N; a new "Show all items in the period" trait removes the count cap entirely; and a new "When nothing matches this period" trait offers a random-items-instead fallback (sampled from an all-time pool, only fetched when a block actually needs it) or a plain link back to the source, instead of silently rendering an empty section.

- Updated dependencies [f18f469]
  - @latestarr/adapter-core@0.7.0
  - @latestarr/adapter-plex@0.7.0
  - @latestarr/adapter-tautulli@0.7.0
  - @latestarr/adapter-audiobookshelf@0.7.0
  - @latestarr/adapter-booklore-family@0.7.0
  - @latestarr/adapter-romm@0.7.0
  - @latestarr/crypto@0.7.0
  - @latestarr/db@0.7.0

## 0.6.0

### Minor Changes

- 8b0936e: Fix the "default layout" (no custom template picked) newsletter render falling back to a stale, pre-poster hardcoded template with no images and no MJML compilation. It now renders through the same MJML pipeline as a custom GrapesJS template, so a default-layout send gets the same poster + metadata cards, responsive layout, and Outlook/MSO compatibility.

### Patch Changes

- ac67cff: Add regression test coverage in `renderMjmlTemplate` for a bug found while verifying the template editor's new preset blocks (apps/web): a `<table>` placed directly under `<mj-column>` (rather than wrapped in `<mj-raw>`) gets silently dropped by MJML's compiler under "soft" validation, with no thrown error. No production server behavior changes — the fix itself is in `apps/web`'s block library, which is what emits this markup.
- 170698b: Fix a real send-failure bug: a custom template saved from the builder before it's ever had an initial design loaded exports a bare MJML fragment (no `<mjml><mj-body>` root element). `renderMjmlTemplate` now wraps such a fragment before compiling instead of letting `mjml2html` reject it outright — previously this would fail the entire send rather than falling back to best-effort rendering, the same way a malformed template already does.
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
