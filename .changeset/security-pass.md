---
"@latestarr/server": minor
"@latestarr/adapter-core": minor
"@latestarr/adapter-plex": patch
"@latestarr/adapter-tautulli": patch
"@latestarr/adapter-jellyfin": patch
"@latestarr/adapter-booklore-family": patch
"@latestarr/adapter-audiobookshelf": patch
"@latestarr/adapter-romm": patch
---

**Improved:** A security review for installs exposed to the internet. The container no longer runs as root, and someone given a temporary password must change it before they can do anything else. Sources and mail servers that stop responding now time out instead of holding up a send, and server errors no longer show internal details. A new guide covers exposing LatestArr safely.

<details>
<summary>Technical details</summary>

Found and fixed in the review for #237:

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
