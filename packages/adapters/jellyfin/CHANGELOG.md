# @latestarr/adapter-jellyfin

## 0.12.6

### Patch Changes

- Updated dependencies []:
  - @latestarr/adapter-core@0.12.6

## 0.12.5

### Patch Changes

- [#373](https://github.com/jshields-ca/LatestArr/pull/373) [`38f6c83`](https://github.com/jshields-ca/LatestArr/commit/38f6c83da3098b58f095be2ff2b39ef172e6df6e) - **Fixed:** Follow-ups to 0.12.4's full reading of sources.

  - **No false warning for Audiobookshelf:** the "may have more new items" warning now appears only when a source really stopped at its 1,000-item cap. Several busy Audiobookshelf libraries could trigger it when none reached its own cap. ([#370](https://github.com/jshields-ca/LatestArr/issues/370))
  - **Most items per section accepts up to 100:** it was limited to 50, while leaving it blank shows up to 100. ([#371](https://github.com/jshields-ca/LatestArr/issues/371))
  - **Code designs stay a sensible length:** a Media List with no count, or set to show everything, now lists at most 100 items, like designs built from options. ([#372](https://github.com/jshields-ca/LatestArr/issues/372))

  <details>
  <summary>Technical details</summary>
  - **[#370](https://github.com/jshields-ca/LatestArr/issues/370):** `readNewest` takes an `onCapReached` callback, called only when reading stopped at `MAX_RECENT_ITEMS` without reaching older items, a short page or an error, and never for an explicit `limit`. `FetchRecentItemsParams.onCapReached` passes it through every adapter, and `run-newsletter.ts` warns from it instead of comparing the source's total with 1,000.
  - **[#371](https://github.com/jshields-ca/LatestArr/issues/371):** the design schema's `sections.limit` and the editor field allow 1–100.
  - **[#372](https://github.com/jshields-ca/LatestArr/issues/372):** the `mediaList` helper caps its selection at `MAX_SHOWN_ITEMS` (100), including `showAll="true"` and a missing `count`. `{{#each items}}` in hand-written MJML stays as written.
  - Found by the latestarr.app session while documenting 0.12.4.

  </details>

- [#376](https://github.com/jshields-ca/LatestArr/pull/376) [`728a304`](https://github.com/jshields-ca/LatestArr/commit/728a304bb3acce9dcbdf2e1fc1dc9a06c0fa7625) - **Fixed:** Jellyfin and Emby sources wait up to 30 seconds for a response, like every other source.

  They gave up after 15 seconds, so a slow or busy server could fail a check or a send that other sources would have finished.

  <details>
  <summary>Technical details</summary>
  - `jellyfin-client.ts` drops its own 15-second `REQUEST_TIMEOUT_MS` for the shared `SOURCE_REQUEST_TIMEOUT_MS`.
  - The 10-second image timeout, defined separately in all six adapter clients, is now `IMAGE_REQUEST_TIMEOUT_MS` in `adapter-core`'s `http-limits.ts`.
  - Tautulli's leftover `DEFAULT_FETCH_COUNT` is renamed `POPULAR_FETCH_COUNT`, since it now only sizes "most watched".
  - The webhook timeout in `alerts.ts` is named `WEBHOOK_TIMEOUT_MS`.

  </details>

- Updated dependencies [[`38f6c83`](https://github.com/jshields-ca/LatestArr/commit/38f6c83da3098b58f095be2ff2b39ef172e6df6e), [`728a304`](https://github.com/jshields-ca/LatestArr/commit/728a304bb3acce9dcbdf2e1fc1dc9a06c0fa7625)]:
  - @latestarr/adapter-core@0.12.5

## 0.12.4

### Patch Changes

- [#366](https://github.com/jshields-ca/LatestArr/pull/366) [`54d3b43`](https://github.com/jshields-ca/LatestArr/commit/54d3b4331418dfd2aa17722308cf6693352b9d76) - **Fixed:** Newsletters no longer miss new items on a busy week.

  - **Everything in the lookback window:** LatestArr read only the 100 newest items from each source, shared by all of its libraries. So on a Plex server, a big week of TV could push that week's movies out of the newsletter entirely. It now reads everything added in the newsletter's lookback window, page by page.
  - **A safety cap:** at most 1,000 items per source (per library for Audiobookshelf) on each check. Reaching it is logged as a warning on the Logs page.
  - **Emails stay a sensible length:** a section with no **Most items per section** limit shows up to 100 items, about the most it could before.

  <details>
  <summary>Technical details</summary>
  - **`adapter-core`:** `readNewest` pages newest-first (`RECENT_PAGE_SIZE` 100) until a page reaches items older than `since`, comes back short, adds nothing new (a source that ignores paging), or the total reaches `MAX_RECENT_ITEMS` (1,000). A first-page error is thrown as before; a later page's error keeps what was read.
  - **Adapters:**
    - Plex: `X-Plex-Container-Start`;
    - Tautulli: `start`;
    - Jellyfin and Emby: `StartIndex`;
    - Audiobookshelf: `page`, from 0;
    - RomM: `offset`;
    - BookLore, BookOrbit and Grimmory: OPDS `page`, from 1, since both BookOrbit and BookLore cap `size` at 100.

  An explicit `limit` still reads that many.

  - **Server:** `run-newsletter.ts` warns when a source returns `MAX_RECENT_ITEMS`. `design.ts` renders sections with `count="${limit ?? MAX_SHOWN_ITEMS}"` (100), and the design editor's placeholder reads "Up to 100". Designs written in code (`{{#each items}}`) aren't capped.
  - Found while documenting the limit for [#362](https://github.com/jshields-ca/LatestArr/issues/362); the "+ N more" line follows in 0.13.0.

  </details>

- Updated dependencies [[`54d3b43`](https://github.com/jshields-ca/LatestArr/commit/54d3b4331418dfd2aa17722308cf6693352b9d76)]:
  - @latestarr/adapter-core@0.12.4

## 0.12.3

### Patch Changes

- Updated dependencies [[`8b4f0b6`](https://github.com/jshields-ca/LatestArr/commit/8b4f0b6bb00276b68e741fbb7e10959f34f8bcf4), [`51b9fad`](https://github.com/jshields-ca/LatestArr/commit/51b9fadc224064b035ac129fd253492540a0832f)]:
  - @latestarr/adapter-core@0.12.3

## 0.12.2

### Patch Changes

- Updated dependencies [[`3bf312b`](https://github.com/jshields-ca/LatestArr/commit/3bf312bf0183ced27ea078ad3d78a62aded159d7)]:
  - @latestarr/adapter-core@0.12.2

## 0.12.1

### Patch Changes

- Updated dependencies []:
  - @latestarr/adapter-core@0.12.1

## 0.12.0

### Patch Changes

- Updated dependencies []:
  - @latestarr/adapter-core@0.12.0

## 0.11.2

### Patch Changes

- Updated dependencies []:
  - @latestarr/adapter-core@0.11.2

## 0.11.1

### Patch Changes

- Updated dependencies []:
  - @latestarr/adapter-core@0.11.1

## 0.11.0

### Minor Changes

- [#214](https://github.com/jshields-ca/LatestArr/pull/214) [`08172d5`](https://github.com/jshields-ca/LatestArr/commit/08172d5c7cd24f7d7e1181bcab5191e0bf8156dd) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** Import users works for every source that has users, including Plex, Jellyfin, and Emby. Those servers don't share email addresses, so the import list now has an email field next to anyone without one; fill it in and that person is imported too. Audiobookshelf and RomM sources can now import their users as well, with the emails those servers already have. For Emby, a user linked to Emby Connect with an email address is filled in for you.

  <details>
  <summary>Technical details</summary>

  Closes [#213](https://github.com/jshields-ca/LatestArr/issues/213).

  - Import users dialog: users without an email get an "Email for {name}" field. A complete address selects them, and clearing it deselects them. Import sends typed addresses alongside the source's own.
  - Audiobookshelf `listUsers`: `GET /api/users` (needs an admin token); active users only, with `email` when set.
  - RomM `listUsers`: `GET /api/users` (needs the client API token's `users.read` scope, which the error message now names on a 401 or 403); enabled users only, with `email` when set.
  - Jellyfin/Emby `listUsers` skips disabled accounts. Emby uses `ConnectUserName` as the email when it is one (untested on a real server; see [#196](https://github.com/jshields-ca/LatestArr/issues/196)).
  - Import users now appears for Plex, Tautulli, Jellyfin, Emby, Audiobookshelf, and RomM. The BookLore family has no user API over OPDS.

  </details>

- [#211](https://github.com/jshields-ca/LatestArr/pull/211) [`e367342`](https://github.com/jshields-ca/LatestArr/commit/e367342bb3c1d3bc3c1c5232a71bfc5c7e15bb5e) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** Jellyfin and Emby sources, for movies, TV episodes, books, and audiobooks. Add one with an API key. Newsletters show each item's poster, details, and a link that opens it in your server's web app, and you can import the server's users as recipients. **These need testers:** they're built from the published API docs but haven't been tried on a real server yet. If you run Jellyfin or Emby, please [tell us how it went](https://github.com/jshields-ca/LatestArr/issues/196).

  <details>
  <summary>Technical details</summary>

  Part of [#196](https://github.com/jshields-ca/LatestArr/issues/196) (the issue stays open until both are confirmed on real servers).

  - New `@latestarr/adapter-jellyfin` package: one client over the API Jellyfin and Emby share (`/System/Info`, `/Library/MediaFolders`, `/Users`, `/Items`, `/Items/{id}/Images/Primary`), with two thin adapters, `jellyfin` and `emby`. They differ only in how the key is sent (Jellyfin: `Authorization: MediaBrowser Token="…"`; Emby: `X-Emby-Token`) and in the web app's item link format. The key is never put in a URL.
  - Recent items are sorted by date added (neither server filters on it), requested once per chosen library, and cut at the lookback window. Episodes are titled by series with an `SxxExx - episode` subtitle and use the series poster. Books and audiobooks show their author; audiobooks show their length.
  - Web: both appear in Add source with an API-key hint and a "needs testers" note linking to [#196](https://github.com/jshields-ca/LatestArr/issues/196), and support Import users. README marks both "🧪 Needs testers" with a call for testers.

  </details>

### Patch Changes

- [#239](https://github.com/jshields-ca/LatestArr/pull/239) [`03d9f31`](https://github.com/jshields-ca/LatestArr/commit/03d9f3130f9fc28d1f51663107b7e5a346b4d3d6) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** A security review for installs exposed to the internet. The container no longer runs as root, and someone given a temporary password must change it before they can do anything else. Sources and mail servers that stop responding now time out instead of holding up a send, and server errors no longer show internal details. A new guide covers exposing LatestArr safely.

  <details>
  <summary>Technical details</summary>

  Found and fixed in the review for [#237](https://github.com/jshields-ca/LatestArr/issues/237):

  **Authentication and sessions**
  - `requireAuth` answers `403 password_change_required` to a user with `mustChangePassword`. Before, only the web UI enforced it, and the API still worked.
  - Signing in to an account that doesn't exist now takes as long as a real password check (`verifyDummyPassword`), so response times don't reveal which emails have accounts.
  - First-run setup checks for existing users and creates the admin in one transaction, so two simultaneous requests can't both create an admin.

  **Requests and responses**
  - The same-origin (CSRF) check rejects `Origin: null`, which a sandboxed iframe or `data:` page sends.
  - A new error handler logs server errors in full and returns a generic message, so SQL errors, file paths and stack details never reach the client. Client errors still say what went wrong.
  - A stored copy of a sent email is served with a `sandbox` Content Security Policy.
  - Pino redacts cookies, authorization headers, and password, token, API key and secret fields as a precaution.

  **Outbound requests and content from sources**
  - Every adapter's API requests time out after 30s (`SOURCE_REQUEST_TIMEOUT_MS`); only the Jellyfin/Emby adapter had a timeout before.
  - Poster downloads are capped at 20 MB (`readBytesCapped`), and sharp refuses images over 40 megapixels.
  - BookLore-family covers linked on another host no longer receive the OPDS Basic credentials.
  - SMTP connections time out after 30s (connect and greeting) and 60s (idle socket), down from Nodemailer's 2 and 10 minutes.
  - MJML `ignoreIncludes` is pinned on, so a code-mode design can't use `<mj-include>` to read server files. MJML 5 already defaults to this.

  **Container**
  - The Docker image runs as the `node` user. An entrypoint uses `su-exec` to hand `/app/data` to that user first, so volumes created by older images keep working. The CI smoke test checks both.

  **Tests and docs**
  - `security.test.ts` walks every registered route and requires a 401 without a session, except an explicit public list. It also covers temporary passwords, the bootstrap race, cross-origin and null-origin writes, error hiding, security headers and cookie flags.
  - `docs/self-hosting.md` has a new "Exposing LatestArr to the internet" section.

  Reviewed with no change needed:
  - OIDC: PKCE, state and nonce are checked and the redirect target is fixed.
  - Queries are parameterized.
  - Handlebars (4.7.9) has prototype access off, and every value is escaped.
  - Credentials are encrypted and stripped from responses.
  - Helmet sets a CSP with `frame-ancestors 'self'`.
  - Sign-in and setup are rate-limited.
  - `pnpm audit` finds no known vulnerabilities.

  </details>

- Updated dependencies [[`03d9f31`](https://github.com/jshields-ca/LatestArr/commit/03d9f3130f9fc28d1f51663107b7e5a346b4d3d6)]:
  - @latestarr/adapter-core@0.11.0
