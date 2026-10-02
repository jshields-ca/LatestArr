---
"@latestarr/server": minor
"@latestarr/web": minor
"@latestarr/db": minor
---

**New:** A way back in when you forget your password. Choose a **System email** profile on the SMTP Profiles page, and the sign-in page gets a **Forgot password?** link that emails you a one-time reset link. Without email, there's a recovery command for whoever runs the server: `docker exec -it latestarr node dist/cli.js reset-password --email you@example.com` prints a temporary password. Another admin can still reset your password from the Users page.

<details>
<summary>Technical details</summary>

- Closes #264.
- **Reset links:** `POST /auth/password-reset/request` and `/confirm`.
  - Tokens are 32 random bytes, stored as SHA-256 hashes in the new `password_reset_tokens` table. They work once, for 30 minutes.
  - A new link cancels older ones, and an account gets at most one email every 2 minutes. Requests are rate limited (5 per 15 minutes per IP).
  - The answer is the same whether or not the account exists, and the email is sent after replying, so timing doesn't reveal it either. SSO-only and deactivated accounts never get a link.
  - Using a link sets the password, signs the account out everywhere, and cancels other links. So does any other password change.
- **Links are built from `WEB_ORIGIN`, never the request's Host header.** When the address in use doesn't match `WEB_ORIGIN` (say, a proxy in front of an install still set to localhost), email resets stay off rather than sending a broken link, and the SMTP Profiles page explains why.
- The token travels in the URL fragment (`/reset-password#token=…`), which browsers never send to a server, so it can't reach access logs. The page removes it from the address bar.
- **System email:** `GET`/`PUT /settings/system-mail` (admin only), stored in `settings`. Deleting the chosen profile turns it off. `/auth/providers` now says whether resets are available.
- **Recovery command** (`dist/cli.js`):
  - `reset-password --email` sets a 24-character temporary password, requires a new one at next sign-in, signs the account out everywhere, and reactivates it if needed.
  - `list-admins` lists the admins.
  - When run as root (the default for `docker exec`), it switches to the data folder's owner first, so SQLite never leaves root-owned files the server can't write.
  - Its actions are written to a new `audit_events` table, which the Logs page merges in.
- CI's Docker smoke test now runs both commands as root, signs in with the printed password, and checks no root-owned files are left in `/app/data`.
- Docs: a "Locked out?" section in `docs/self-hosting.md`, and `WEB_ORIGIN`'s role in reset links.

</details>
