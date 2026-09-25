---
"@latestarr/server": patch
---

**Fixed:** Setting `TRUST_PROXY=true` in `.env` now takes effect. Before, Docker Compose never passed it to the container, so instances behind a reverse proxy saw every visitor as the proxy's IP address (sharing one sign-in rate limit) and didn't mark the session cookie as secure.

<details>
<summary>Technical details</summary>

Closes #176. `TRUST_PROXY` was documented in `.env.example` and `docs/self-hosting.md` but missing from `docker-compose.yml`'s `environment:` block, so `process.env.TRUST_PROXY` was always unset inside the container and Fastify's `trustProxy` stayed off. Added `TRUST_PROXY: ${TRUST_PROXY:-}`.

CI now fails if any key in `.env.example` isn't referenced in `docker-compose.yml`, so a newly documented setting can't be silently dropped again.

</details>
