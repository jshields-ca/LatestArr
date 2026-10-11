---
"@latestarr/server": minor
"@latestarr/web": minor
---

**Fixed:** Signing in with SSO from another address, such as the server's LAN IP, failed with "Missing or expired OIDC sign-in attempt". **New:** link SSO to an existing account from your profile.

- **Sign-in from another address** now works: **Continue with SSO** first moves you to the address in `OIDC_REDIRECT_URI`, where your identity provider sends you back.
- **Link SSO** in your profile connects your SSO account to the account you're signed in to. It works even when your provider doesn't mark your email address as verified, which stopped automatic matching before. **Unlink SSO** is there too, for accounts that also have a password.
- **Plain messages:** a failed SSO sign-in now goes back to the sign-in page with a reason, not a page of raw JSON, and the logs say exactly why.

<details>
<summary>Technical details</summary>

- Refs #317.
- **`GET /api/auth/oidc/login`** redirects to the `login` URL next to `OIDC_REDIRECT_URI` when the request's host differs. The flow cookie can only be set on the host the provider returns to. The redirect target comes from config, never the request.
- **Callback errors** redirect to `/login?sso=<outcome>` (or `/?sso=` for linking) under `WEB_ORIGIN`. The outcomes are `expired`, `failed`, `unverified-email`, `not-linked`, `linked`, `link-taken` and `link-failed`. `OidcAccountNotLinkedError` carries a `reason` (`unverified-email`, `no-account` or `inactive`), which is logged.
- **Linking:**
  - `POST /api/auth/oidc/link` needs a session and passes the same-origin check. It returns the provider URL, and the flow cookie records `link.<userId>`.
  - The callback links only if the same session is still signed in, and refuses an identity that belongs to another account.
  - `DELETE /api/auth/me/sso` unlinks, and is refused for an account without a password.
  - `GET /api/auth/me` adds `ssoLinked` and `hasPassword`.
- **Web:** `lib/sso.ts` holds the outcome messages. The login page shows the reason, the app shell shows a toast after linking, and the profile has a Single sign-on section.

</details>
