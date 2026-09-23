# @latestarr/adapter-core

## 0.10.0

### Minor Changes

- [#147](https://github.com/jshields-ca/LatestArr/pull/147) [`d2c7c33`](https://github.com/jshields-ca/LatestArr/commit/d2c7c33833d4ab6a2eb802e7270b51a9a83113be) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** Import a Plex or Tautulli source's known users as recipients, grouped together, from the Sources page.

  <details>
  <summary>Technical details</summary>

  `SourceAdapter` (`packages/adapters/core/src/source-adapter.ts`) gains an optional `listUsers?(config): Promise<SourceUser[]>`, the same optional-capability pattern as `fetchPopularItems`/`fetchImageBytes`. Implemented for:

  - **Tautulli**, via its `get_users` API (`getUsers` in `tautulli-client.ts`) — includes each user's `email` when Tautulli has it (synced from the underlying Plex server's shared-user list), filtering out its "Local" pseudo-user (id 0).
  - **Plex**, via the local server's own `/accounts` endpoint (`getAccounts` in `plex-client.ts`) — usernames only, no email. A local server token can't reach plex.tv's own account API, which is the only place a shared user's email is visible; `SourceUser.email` is optional specifically to let a caller (and `NewItem`'s doc comment) handle this per-source gap rather than assuming every source can supply one.

  New `GET /sources/:id/users` (`apps/server/src/http/routes/sources.ts`) 404s (not a 200 with an empty array) when the adapter doesn't implement `listUsers`, so the web UI can tell "unsupported" apart from "zero users right now."

  New "Import users" action on a Plex/Tautulli source row (`apps/web/src/pages/sources-page.tsx`) opens a dialog listing the source's users — pre-checked when they have an email, disabled when they don't (a recipient can't exist without one) — and imports the selected ones via the existing bulk-import endpoint (`POST /recipients/import`, from the CSV/text-paste import feature), then adds each newly-created recipient to a group named after the source, reusing an existing group of that name on a repeat import rather than creating a duplicate.

  </details>

## 0.9.0

No changes in this release.

## 0.8.0

No changes in this release.

## 0.7.1

### Patch Changes

- 51311b4: Bump eslint (9 → 10) and @eslint/js (9 → 10) across every package, and jsdom (25 → 29.1.1) in apps/web's test environment. Dev-tooling only, no runtime dependency changes.

  The Dependabot PRs for eslint/@eslint/js (#97, #105) failed CI with a stale, out-of-sync pnpm-lock.yaml on their branch — reproduced locally with a freshly regenerated lockfile and confirmed all 40 lint/typecheck/build/test tasks pass cleanly; `eslint-plugin-jsx-a11y`'s declared peer range hasn't caught up to eslint 10 yet, but it lints without error in practice.

  jsdom's own Dependabot PR (#104) proposed 25 → 30, but jsdom 30 dropped Node 20 support entirely (`engines: "^22.22.2 || ^24.15.0 || >=26.0.0"`), which broke this repo's Node 20.x CI job with `TypeError: webidl.util.markAsUncloneable is not a function` — a real Node-runtime incompatibility, not a lockfile issue. Landing on 29.1.1 instead (the latest jsdom release that still supports Node 20.19+) gets most of the version currency without dropping Node 20 CI support, which is a bigger call than a routine dependency bump.

- 73a6d37: Bump vite (6 → 8, apps/web only), vitest (4 → 5, every package), and @vitejs/plugin-react (4 → 6, apps/web only). Dev-tooling only, no runtime dependency changes.

  Bumped all three together since they're an interlocking build/test toolchain — vitest 5 pins a vite 6+ peer, and @vitejs/plugin-react needs to track the vite major it's paired with. `pnpm turbo run lint typecheck build test` is fully green (40/40 tasks, 189 server tests, 225 web tests); no config changes needed in `apps/web/vite.config.ts` or any `vitest.config`.

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

### Minor Changes

- dc5a521: Add an optional `fetchPopularItems` capability to the `SourceAdapter` contract for ranking items by watch activity ("most watched this week") instead of recency, and implement it for Tautulli via `get_home_stats`. This lays the data groundwork for the newsletter builder's "Most Watched" sort option.
