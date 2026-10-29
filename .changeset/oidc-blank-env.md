---
"@latestarr/server": patch
---

**Fixed:** SSO sign-in works when `OIDC_SCOPES` is left blank, as `.env.example` shows.

With the provided `docker-compose.yml`, a blank `OIDC_SCOPES` reached LatestArr as an empty value rather than a missing one. LatestArr then asked your SSO provider for no scopes, so providers refused the sign-in or sent no ID token. A blank value now means the default, `openid profile email`. A blank `OIDC_CLIENT_SECRET` likewise now means no secret, as it should for public clients. If you set `OIDC_SCOPES=openid profile email` to work around this, you can leave it set.

<details>
<summary>Technical details</summary>

`loadOidcConfigFromEnv` reads them with `||` instead of `??`: `OIDC_SCOPES?.trim() || "openid profile email"` and `OIDC_CLIENT_SECRET || undefined`. Compose passes each `OIDC_*` setting with an empty default, so these were always set. A new `oidc-config.test.ts` covers missing, blank and set values. Found by the latestarr.app session. Fixes #416.

</details>
