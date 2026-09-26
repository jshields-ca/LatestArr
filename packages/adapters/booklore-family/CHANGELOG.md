# @latestarr/adapter-booklore-family

## 0.11.0

### Patch Changes

- Updated dependencies []:
  - @latestarr/adapter-core@0.11.0

## 0.10.0

### Patch Changes

- [#170](https://github.com/jshields-ca/LatestArr/pull/170) [`59845f4`](https://github.com/jshields-ca/LatestArr/commit/59845f425654c5363990dbaaa4d06807bbac17c7) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** A book's release year from Book Orbit/BookLore could show one year earlier than its actual publication year, for anyone self-hosting in a timezone west of UTC.

  <details>
  <summary>Technical details</summary>

  `mapEntry()` in `packages/adapters/booklore-family/src/booklore-adapter.ts` built `releaseDate` from OPDS's `dc:issued` field via `new Date(issued)`. `dc:issued` only ever appears as a bare 4-digit year (e.g. `"2020"`), and `new Date("2020")` parses that as UTC midnight — reading it back with local-time getters (`getFullYear()`, `toLocaleDateString()`, ...) in any negative-UTC-offset timezone rolls it back to December 31 of the previous year.

  Also the root cause of a flaky test (`booklore-adapter.test.ts`'s "maps entries and filters by the since cutoff", filed as [#164](https://github.com/jshields-ca/LatestArr/issues/164)) that only failed on a non-UTC-configured machine.

  Fixed by constructing the date in local time (`new Date(Number(issued), 0, 1)`) when `dc:issued` is a bare year, so the year survives the round trip regardless of the host's timezone. A full date string, should one ever appear, still goes through the plain `Date` parser unchanged.

  </details>

- Updated dependencies [[`d2c7c33`](https://github.com/jshields-ca/LatestArr/commit/d2c7c33833d4ab6a2eb802e7270b51a9a83113be)]:
  - @latestarr/adapter-core@0.10.0

## 0.9.0

### Patch Changes

- @latestarr/adapter-core@0.9.0

## 0.8.0

### Patch Changes

- @latestarr/adapter-core@0.8.0

## 0.7.1

### Patch Changes

- 51311b4: Bump eslint (9 → 10) and @eslint/js (9 → 10) across every package, and jsdom (25 → 29.1.1) in apps/web's test environment. Dev-tooling only, no runtime dependency changes.

  The Dependabot PRs for eslint/@eslint/js (#97, #105) failed CI with a stale, out-of-sync pnpm-lock.yaml on their branch — reproduced locally with a freshly regenerated lockfile and confirmed all 40 lint/typecheck/build/test tasks pass cleanly; `eslint-plugin-jsx-a11y`'s declared peer range hasn't caught up to eslint 10 yet, but it lints without error in practice.

  jsdom's own Dependabot PR (#104) proposed 25 → 30, but jsdom 30 dropped Node 20 support entirely (`engines: "^22.22.2 || ^24.15.0 || >=26.0.0"`), which broke this repo's Node 20.x CI job with `TypeError: webidl.util.markAsUncloneable is not a function` — a real Node-runtime incompatibility, not a lockfile issue. Landing on 29.1.1 instead (the latest jsdom release that still supports Node 20.19+) gets most of the version currency without dropping Node 20 CI support, which is a bigger call than a routine dependency bump.

- 73a6d37: Bump vite (6 → 8, apps/web only), vitest (4 → 5, every package), and @vitejs/plugin-react (4 → 6, apps/web only). Dev-tooling only, no runtime dependency changes.

  Bumped all three together since they're an interlocking build/test toolchain — vitest 5 pins a vite 6+ peer, and @vitejs/plugin-react needs to track the vite major it's paired with. `pnpm turbo run lint typecheck build test` is fully green (40/40 tasks, 189 server tests, 225 web tests); no config changes needed in `apps/web/vite.config.ts` or any `vitest.config`.

- Updated dependencies [51311b4]
- Updated dependencies [73a6d37]
  - @latestarr/adapter-core@0.7.1

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

## 0.6.0

### Patch Changes

- @latestarr/adapter-core@0.6.0

## 0.5.0

### Patch Changes

- @latestarr/adapter-core@0.5.0

## 0.4.6

### Patch Changes

- @latestarr/adapter-core@0.4.6

## 0.4.5

### Patch Changes

- @latestarr/adapter-core@0.4.5

## 0.4.4

### Patch Changes

- @latestarr/adapter-core@0.4.4

## 0.4.3

### Patch Changes

- @latestarr/adapter-core@0.4.3

## 0.4.2

### Patch Changes

- @latestarr/adapter-core@0.4.2

## 0.4.1

### Patch Changes

- @latestarr/adapter-core@0.4.1

## 0.4.0

### Patch Changes

- @latestarr/adapter-core@0.4.0

## 0.3.0

### Patch Changes

- @latestarr/adapter-core@0.3.0

## 0.2.0

### Minor Changes

- 20b13fd: Add a BookLore-family adapter (`@latestarr/adapter-booklore-family`) covering BookLore and its compatible forks BookOrbit and Grimmory. These expose their library through OPDS (a standardized Atom-based catalog format, HTTP Basic Auth) rather than a stable internal REST API, so this adapter parses OPDS feeds directly. Since all three forks share the same OPDS surface, this ships as a single adapter factory rather than three near-duplicate implementations — `bookloreAdapter`, `bookOrbitAdapter`, and `grimmoryAdapter` differ only in their `kind` identifier.

### Patch Changes

- Updated dependencies [dc5a521]
  - @latestarr/adapter-core@0.2.0
