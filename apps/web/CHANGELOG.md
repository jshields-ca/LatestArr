# @latestarr/web

## 0.8.0

### Minor Changes

- 8b65554: **New:** Add a single "All New (This Period)" block to the template editor — drop it into a newsletter and it shows everything added recently, grouped by type (movies, TV episodes, TV seasons, books, audiobooks, games), instead of needing to drag in and configure six separate blocks by hand.

  <details>
  <summary>Technical details</summary>

  Addresses the most common request in production feedback on the Media List blocks: "there isn't any options for 'all new' based on the lookback settings in the Newsletter itself... they would expect all of the latest media (audiobooks, tv shows, movies, books, etc) for that lookback period." Getting that today meant dragging in all six content-kind presets one at a time and turning on each one's "Show all items in the period" trait by hand — this is the same result as one block.

  Dragging in "All New (This Period)" exports one heading + Media List pair per adapter content kind, each reading from the same lookback-scoped `items` pool a per-kind block already does and each already using the existing, shipped `showAll="true"` mechanism (from a previous release's "Show all items in the period" trait) rather than a capped count. A kind with nothing added this period is skipped entirely — heading included, not just its (empty) list — via a new `ifAnyItems` Handlebars block helper (`apps/server/src/render/mjml-template.ts`) that applies the exact same pool + content-type filter `mediaList` itself does, purely to decide whether to render a heading. Without it, a newsletter with e.g. no new games this week would still show a bare "Games" heading over nothing.

  It's registered as its own GrapesJS component type (`media-list-all-new`), not a second implementation of the card markup: the poster+text `<table>` layout and the `{{#mediaList ...}}` hash-argument tag are now both extracted into shared functions (`mediaListCardBody`/`mediaListOpenTag` in `apps/web/src/lib/grapesjs-blocks.ts`) that the standalone Media List block's own `toHTML()` also calls, so the two can't drift apart. Like the standalone block, its canvas preview is a friendly static summary (real per-kind grouping only happens at MJML export time, against real item data at send time) and has no configurable traits — narrowing to one kind is what the existing per-kind presets are for.

  </details>

### Patch Changes

- a386217: **Improved:** Buttons now feel smoother and more premium to hover over — a subtle light sweep and an easier lift, instead of an abrupt bump.

  <details>
  <summary>Technical details</summary>

  Addresses production feedback that the primary button's hover lift felt "bumpy" rather than premium. The hover-triggered lift/shadow now transitions on a slower, spring-like `cubic-bezier(0.34, 1.56, 0.64, 1)` curve at 220ms (up from the shared 150ms linear-ish default), scoped to the `default` variant only via `hover:` utilities so every other button's snappy press-state timing is untouched. A one-shot diagonal light sweep (`.btn-glint` in `index.css`, a `::after` gradient translated across the button and clipped by `overflow-hidden`) plays once per hover-enter rather than looping, and is disabled under `prefers-reduced-motion`.

  </details>

- a386217: **Improved:** The LatestArr logo is more prominent, the version/GitHub/Star links now sit right next to it on mobile too (matching how they already looked on desktop), and the old hidden "About" info icon has been replaced with a real page footer showing the license, the author, and a link to report an issue.

  <details>
  <summary>Technical details</summary>

  Makes the wordmark more prominent (a larger `LogoMark`, larger tracked-out text with a subtle rose gradient fill) and moves the version/GitHub/Star cluster up next to the `Logo` in the mobile nav sheet, matching where it already sits in the desktop header — the two surfaces now read as one consistent design. Removes the sidebar's "About" info-icon popover (author/license/site) entirely and replaces it with a real page footer, visible on every page instead of hidden behind a click: author link, GPLv3 license link, a "Report an issue" link to the GitHub issue tracker, and an "In Active Development" badge.

  </details>

- c5e8616: **Fixed:** Saving a template no longer briefly rebuilds the entire editor canvas behind the scenes (harmless today, but wasteful and a source of subtle glitches down the line).

  <details>
  <summary>Technical details</summary>

  Root-caused while investigating a test that failed intermittently on CI (`template-editor-page.test.tsx`'s "warns on tab close/refresh..." test, "expected true to be false"). Two separate issues, found via instrumented reproduction rather than assumed:

  1. **Real production bug**: `handleSave`'s `setTemplate(updated)` on a successful save gives `template` a new object identity every time. The GrapesJS-init `useEffect` was keyed on `[template]`, so this retriggered it — and a dependency-array change always runs the _previous_ run's cleanup (`editor.destroy()`, `editorRef.current = null`) before the new run's own `editorRef.current` guard is even evaluated, so the guard couldn't prevent it. Every save destroyed and fully reinitialized the GrapesJS editor (confirmed via an instrumented test run: `mockInit` called twice, `destroy` called once, for a single save). Fixed by keying the effect on `Boolean(template)` instead — true exactly once, on the null-to-loaded transition — which matches the effect's actual intent ("initialize once, when data first arrives") without discarding the canvas on every subsequent save. Added a regression assertion (`mockInit`/`mockEditor.destroy` call counts) to the existing save test.

  2. **Real test-helper race** (this was the CI flake's actual cause, confirmed by reproducing it locally — 2 failures in 60 runs before the fix, 0 in 80 after): `simulateEditorContentChange()` fired GrapesJS's mocked content-change handlers immediately after `await screen.findByText("Weekly Digest")` resolved. But `findByText`'s MutationObserver-based resolution isn't guaranteed to happen after _every_ passive effect from the same commit has flushed — the GrapesJS-init effect (which registers the content-change handler at all) is a separate, independently-scheduled effect, so `contentChangeHandlers` could still be empty at that point, making the simulated "edit" a silent no-op. Fixed by having the shared test helper itself wait for a handler to actually be registered before firing it, rather than relying on each call site to remember to check — the same synchronization other tests in this file already used for `mockInit`, just not applied here.

  </details>

- a386217: **Improved:** It's now easier to see which page you're on — the active item in the sidebar gets a clear accent bar, not just a subtle color change.

  <details>
  <summary>Technical details</summary>

  Gives the sidebar/nav-sheet's active nav item a left-edge accent bar (a 3px `bg-primary` pill) on top of its existing background tint, and gives the hover state a slightly slower, clearer background transition — production feedback was that the active state alone was easy to miss at a glance. `navItems` remains a flat list (no section grouping was added, since the current six items don't split into a natural, non-arbitrary category split).

  </details>

- a386217: **Improved:** Added a new accent color (a calm blue) used for informational badges like the version number and the "In Active Development" label, giving the app's look a bit more depth.

  <details>
  <summary>Technical details</summary>

  Adds a third palette hue — `--tertiary`/`--tertiary-foreground` (indigo/blue, hue ~228) — as a genuine design token alongside `--primary`, following production feedback that the "Bloom" palette had nowhere to go for calm, informational UI beyond the rose primary and the ad hoc violet secondary accent. Indigo/blue was picked as the clearest complementary/triadic partner to rose while staying clear of green (already success) and red/orange (already destructive, and Plex's own brand color); both the light and dark pairs clear 4.5:1+ text contrast the same way every other token pair in `index.css` does. Wired into Tailwind as `bg-tertiary`/`text-tertiary-foreground` and exposed as a new `Badge` `tertiary` variant, used for the header's running-version badge and the new footer's "In Active Development" badge — reserved for informational labels, never a semantic success/warning/destructive state.

  </details>

## 0.7.1

### Patch Changes

- 51311b4: Bump eslint (9 → 10) and @eslint/js (9 → 10) across every package, and jsdom (25 → 29.1.1) in apps/web's test environment. Dev-tooling only, no runtime dependency changes.

  The Dependabot PRs for eslint/@eslint/js (#97, #105) failed CI with a stale, out-of-sync pnpm-lock.yaml on their branch — reproduced locally with a freshly regenerated lockfile and confirmed all 40 lint/typecheck/build/test tasks pass cleanly; `eslint-plugin-jsx-a11y`'s declared peer range hasn't caught up to eslint 10 yet, but it lints without error in practice.

  jsdom's own Dependabot PR (#104) proposed 25 → 30, but jsdom 30 dropped Node 20 support entirely (`engines: "^22.22.2 || ^24.15.0 || >=26.0.0"`), which broke this repo's Node 20.x CI job with `TypeError: webidl.util.markAsUncloneable is not a function` — a real Node-runtime incompatibility, not a lockfile issue. Landing on 29.1.1 instead (the latest jsdom release that still supports Node 20.19+) gets most of the version currency without dropping Node 20 CI support, which is a bigger call than a routine dependency bump.

- 23ebd9a: Bump react and react-dom (18 → 19) and their `@types` packages. Dev/runtime dependency only.

  Low migration risk in this codebase: `main.tsx` already uses `ReactDOM.createRoot` (no legacy `ReactDOM.render` to migrate), there's no direct `react-dom/test-utils` import (React 19 moved `act` into `react` itself), and no component uses `defaultProps` on a function component (removed in 19). `@testing-library/react@16` (already in use) and `react-router-dom@7` already support React 19.

  `pnpm turbo run lint typecheck build test` is fully green (40/40 tasks, 225 web tests, no React deprecation warnings in test output). Beyond the test suite, built the app and drove it with a real headless Chromium session against the built server (signup → dashboard → navigated Sources/Recipients/Newsletters/Templates → opened the Add Source dialog) — no console errors, no visual regressions, confirmed by screenshot.

- 73a6d37: Bump vite (6 → 8, apps/web only), vitest (4 → 5, every package), and @vitejs/plugin-react (4 → 6, apps/web only). Dev-tooling only, no runtime dependency changes.

  Bumped all three together since they're an interlocking build/test toolchain — vitest 5 pins a vite 6+ peer, and @vitejs/plugin-react needs to track the vite major it's paired with. `pnpm turbo run lint typecheck build test` is fully green (40/40 tasks, 189 server tests, 225 web tests); no config changes needed in `apps/web/vite.config.ts` or any `vitest.config`.

## 0.7.0

### Minor Changes

- 642ba8b: Design system refresh addressing v0.6.0 production feedback: typography, type hierarchy, visual personality, and consistent save/error feedback across every admin page.

  - **Typography**: adds Plus Jakarta Sans as the app's UI/body face (via `--font-sans`), replacing the unstyled default system-font stack. Newsreader — previously reserved for the "LatestArr" wordmark — now also sets each page's own `<h1>` (a new `PageHeader` component, used on Dashboard, Sources, Recipients, SMTP Profiles, Newsletters, and Templates) at a larger display size, giving the app an actual typographic voice at the one spot per page where it doesn't compete with body text.
  - **Hierarchy**: standardizes the in-page section-label tier (previously plain `text-sm font-medium` — the same weight as plenty of nearby bold body text, e.g. "Template", "Sources", "Recipient groups", "Send history" on the Newsletters page) into a new `SubsectionHeading` component: a small uppercase, tracked-out label distinct from both the page `<h1>` and from bold body copy. Page titles and `<h2>` section headers were already consistent and are unchanged.
  - **Visual personality**: adds violet as a restrained secondary accent (Tailwind's own palette, matching how Badge's success/warning variants and the dashboard's stat tiles already work — no new color tokens) via a new `accent` Badge variant, used on the dashboard's "Optional" checklist tag and a template's "Designed" status. Floating chrome that has real content behind it to blur — Popover, Select, Dialog/Sheet content, and the new toast notifications — gets a translucent, blurred ("glassy") background instead of a flat opaque one; static cards get a faint inset highlight ring for the same read without the wasted compositing cost of blurring nothing. Every button now gets a quick press-down scale on `:active` (previously only the primary variant's hover-lift existed, from the original Bloom rebrand), and the primary button's hover-lift transition now animates only `transform`/`box-shadow`/`background-color`/`color`/`border-color` instead of `transition-all`.
  - **Toasts**: adds a Radix-based toast system (`ui/toast.tsx` + `ui/use-toast.ts` + a `Toaster` mounted once in `App.tsx`, following this codebase's existing Radix-wrapper pattern) and wires it into every save/update/delete/toggle/test/send action across Sources, Recipients, Groups, SMTP Profiles, Newsletters, and Templates — including several actions (the Newsletters template picker, group-member add/remove, the enabled toggle) that previously gave no feedback at all, or reused unrelated inline error state. The template editor's existing inline "Saved" indicator is untouched; it now gets a corresponding toast alongside it rather than being replaced.
  - Reuses the existing `SourceLogo` component on the Newsletters page's linked-source badges, which were missing the per-source-kind icon that the Sources page itself already shows.

  All recolored/retinted surfaces were checked against WCAG AA (4.5:1) in both themes, including the new translucent surfaces at worst-case backdrop extremes.

### Patch Changes

- 5b299e6: Redesign the relationship between the top banner and the sidebar footer, addressing feedback from a production user: the header was mostly dead space (just the theme toggle), the sidebar footer's account email got cut off next to the Edit profile/Sign out buttons, and the Star icon linked straight out to GitHub with no context. The version/GitHub/Star/About cluster and the account summary (name, email, edit, sign out) now live in the desktop header, which has the width to give the email room to stay legible (still truncates gracefully with a `title` tooltip if needed) instead of the cramped 240px sidebar column; the sidebar itself is now just branding-free navigation. The Star icon now opens a small popover — matching the existing About popover's pattern — with a short explanation of why starring helps, and a button that actually links out to GitHub, instead of linking out immediately. The version badge's text is also a size larger while keeping the same mini-card styling. The mobile nav sheet keeps the same compact card layout as before, unchanged.
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

### Minor Changes

- 12df8b1: Newsletter admin fixes from design review and a real send-now test run: newsletter cards now show a human-readable schedule ("Weekly on Monday at 8:00 AM") instead of the raw cron string for schedules the Simple picker can express; the Add newsletter dialog defaults Timezone to the browser's own zone instead of always UTC, and pre-selects the SMTP profile when there's exactly one; the Add/Edit newsletter dialogs group their Schedule and Delivery fields into labeled sections instead of one flat list; a "Send now" that completes with nothing actually sent (no linked source or recipient group) is now visually distinguished from a real send in Send History and on the Dashboard; a genuine send failure (e.g. an unreachable source) now returns a specific, structured error instead of a bare "Internal Server Error", shown inline the moment the send fails; and Send History now refreshes automatically right after a "Send now" click resolves instead of requiring a page reload.
- 5fb2608: Replace the native `<select>` dropdown with a custom-rendered one built on `@radix-ui/react-select`. Every other primitive in the app (Button, Dialog, Switch, Input) is already fully themed, but the browser's own OS dropdown chrome still showed through whenever a Select was opened — bright white on Linux/Windows, breaking out of the app's dark, all-custom aesthetic. The dropdown popover now matches the app's dialogs (same border/shadow/radius/animation language) in both light and dark mode. `Select`'s props are unchanged for every existing call site.

### Patch Changes

- 291d466: Dashboard polish from testing feedback: recent sends now show which newsletter, item/recipient counts, and outcome per entry (reusing the same Send History status logic as the Newsletters page) instead of just a status badge and timestamp; the setup checklist collapses to a small "Setup complete" summary once every required step is done, expandable again to double-check anything, instead of either vanishing or staying full-size forever; the stat tiles (Sources/Recipients/SMTP Profiles/Newsletters) now use per-tile accent-colored icon chips, a hover lift, and a secondary metric where one is meaningful (open sources needing attention, recipient group count, active newsletters); the checklist and Recent sends cards sit side by side on wide screens instead of stacking narrow and leaving the right side of the page empty; and the destructive/warning/success Badge text colors were adjusted to clear WCAG AA contrast against their tinted backgrounds in both themes.
- ac67cff: Expand the template editor's block library beyond the previous three generic blocks (Header, Footer, Media List) so it's actually discoverable: six new "content-kind" preset blocks (Movies, TV episodes, TV seasons, Books, Audiobooks, Games) let a user drag in a ready-to-go section for a specific *arr media kind instead of dragging the generic Media List and then hunting for its Content type trait afterward — each preset is just the existing Media List component with that trait pre-set, not a second implementation. Also add two standard newsletter-builder primitives the library was missing entirely: a Divider (`mj-divider`) and a Spacer (`mj-spacer`). The block panel is now organized under "Layout" (Header, Footer, Divider, Spacer) and "Content" (Media List and its six presets) category headers instead of one flat, unlabeled list.

  Also fixes a real bug surfaced while verifying the new preset blocks against the actual MJML compile pipeline (not just the editor canvas): the Media List component's exported `<table>` markup sat directly under `<mj-column>` with no `<mj-raw>` wrapper, so MJML's compiler silently dropped it (no thrown error under "soft" validation) — meaning the _existing_, already-shipped Media List block rendered its section as empty in a real compiled/sent newsletter despite looking correct in the editor. This affects every content type, not just the new presets, and is fixed alongside them since it shares the same `toHTML()` code.

- 2b050c7: Add a proper "Page not found" screen (with a link back to the Dashboard) for unknown routes, replacing the blank content area you'd get from mistyping a URL like `/smtp-profiles` instead of `/smtp`. Also fix the first-admin signup form only flagging the Password field when submitted empty — Name and Email now get the same red-border-and-inline-message treatment when they're missing too.
- 4aa2379: Restyle the Send History list on the newsletter card so each send-run reads as a distinct, scannable row instead of plain wrapped text: a status icon (matched to the existing badge colors), the timestamp and outcome badge on one line, item/recipient counts and any error message below, all inside a bordered row. Failed and partially-failed sends get a red left accent and tinted background so problems stand out without reading every row. No changes to what data is fetched or when it refreshes.
- 2d6dbc9: Redesign the sidebar's bottom "about" area (version, GitHub links, author, license, site) as a compact bordered mini-card instead of stacked plain text. The version now shows as a small badge, and the "Jeremy Shields · GPLv3 · scootr.ca" attribution moves behind a keyboard-accessible Info popover (built on Radix Popover) so the footer reads as one deliberate row rather than an afterthought, in both the desktop sidebar and the mobile nav sheet.
- b74e7bb: Simplify the SMTP profile Add/Edit dialog's port and encryption copy. Based on direct user testing feedback, the two-sentence paragraph explaining STARTTLS vs. implicit TLS under the "Use implicit TLS" toggle assumed email-server knowledge most self-hosters don't have. It's replaced with a "Port & encryption" section containing a compact, always-visible reference (587 = STARTTLS, 465 = implicit TLS, 25/2525 = usually unencrypted) and a one-line hint under the toggle, both wired up with `aria-describedby` for accessibility. The toggle's behavior (including auto-defaulting on for port 465) is unchanged.
- fcdd37e: Sources page polish from testing feedback: each source kind now shows its service's own logo (Tautulli, Plex, BookLore, BookOrbit, Grimmory, Audiobookshelf, and RomM) next to its kind label in the sources list and in the Add/Edit dialog's Source type picker, bundled locally rather than hotlinked; and the OPDS username/password fields for the BookLore-family sources (BookLore, BookOrbit, Grimmory) now have a plain-language hint explaining that OPDS is just the login for that app's own web reader, not a separate API key.
- 9f184d3: Fix five usability bugs in the template editor: GrapesJS's default panel buttons (Open Blocks, Settings, Layers, etc.) rendered as blank squares because their built-in icons depend on Font Awesome, which this app never loads; the editor's selection/active-state accent showed GrapesJS's own stock orange (from the grapesjs-mjml plugin's custom theme) instead of the app's Bloom pink; clicking the Media List block's preview card selected an inner generic child instead of the block itself, hiding its real Content type/Sort/Number of items traits behind an unlabeled "select parent" step; the Move up/down toolbar buttons rendered as thin unicode arrows next to GrapesJS's bold icons and silently no-opped at the top/bottom of a list with no feedback; and the editor had no unsaved-changes protection at all, so a refresh or the page's own Back button silently discarded in-progress work.
- af3bf57: Consolidate the admin CRUD pages (Sources, Recipients & Groups, SMTP Profiles, Newsletters, Templates) onto a shared `ListRow` component instead of five hand-rolled row layouts that had drifted apart in spacing, hover treatment, and how metadata badges sat next to a row's name. Every row now uses the same leading-icon/primary/secondary/actions shape and the same responsive header layout (stacked on mobile, side-by-side from `sm:` up), so moving between pages no longer shows subtly different row heights or gaps. Also dedupes the identical `ConfirmDelete` inline prompt that Recipients and Templates each defined on their own into a shared `ConfirmDeleteButton`. No page's behavior, click targets, or `aria-label`s changed — this is a visual/structural consolidation only.

  Also gives Recipient Groups an Edit dialog (previously groups could only be added and deleted, so fixing a typo in a group's name meant losing its members by recreating it). It mirrors Recipients' own Edit dialog and reuses the `PATCH /recipient-groups/:id` server route that already existed for it.

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
