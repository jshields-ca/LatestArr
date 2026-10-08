# @latestarr/adapter-jellyfin

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
