# Self-hosting LatestArr

A full walkthrough from a fresh checkout to a first sent newsletter. If you just want the fastest path, the [README's Getting started](../README.md#getting-started) section is the short version of steps 1–3 below.

## 1. Prerequisites

- Docker and Docker Compose (or a way to run a single container with a persistent volume, if you're not using Compose).
- At least one media server LatestArr can connect to (Tautulli, direct Plex, a BookLore-family app, Audiobookshelf, or RomM) — see [Supported sources](../README.md#supported-sources).
- SMTP credentials to send mail from. Any standard SMTP server works — see [Deliverability](deliverability.md) for provider-specific notes and, importantly, why your digest emails might otherwise land in spam.
- A domain or reverse proxy in front of the container if you're exposing it to the internet (see [Running behind a reverse proxy](#running-behind-a-reverse-proxy) below) — LatestArr itself only speaks plain HTTP.

## 2. Configure

```bash
cp .env.example .env
```

Open `.env` and set:

- **`ENCRYPTION_KEY`** (required) — encrypts every source connection's credentials, SMTP credentials, and the OIDC client secret at rest. Generate one with:
  ```bash
  openssl rand -base64 32
  ```
  Store this somewhere durable outside the repo (a password manager, a secrets store). If you lose it, every encrypted credential in the database becomes unreadable — sources, SMTP profiles, and OIDC config would all need to be re-entered.
- **`WEB_ORIGIN`** (optional) — the externally-reachable URL of this instance, e.g. `https://newsletter.example.com`. Only matters if you're exposing this beyond `localhost` or enabling OIDC (some providers validate the redirect URI's origin). Defaults to `http://localhost:3000`.
- The four `OIDC_*` variables (optional) — see [Setting up OIDC/SSO](#setting-up-oidcsso) below. Leave all four blank for local username/password auth only, which is the default and requires no configuration.

Every variable is documented in [`.env.example`](../.env.example).

## 3. Start the container

```bash
docker compose up -d
```

This builds the image from [`docker/Dockerfile`](../docker/Dockerfile) and starts one container exposing port `3000`, with a named Docker volume (`latestarr-data`) holding the SQLite database at `/app/data`. Nothing else to stand up — no separate database or cache container.

If you'd rather not use Compose, the equivalent is:

```bash
docker build -t latestarr -f docker/Dockerfile .
docker run -d \
  -p 3000:3000 \
  -e ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  -v latestarr-data:/app/data \
  --name latestarr \
  latestarr
```

## 4. First run

Visit `http://localhost:3000` (or wherever you've exposed it). The first thing you'll see is an admin account creation form — this only appears when the database has zero users, and the endpoint that creates it refuses once one exists, so it can't be used to create a second admin later (add more users the normal way, once that's supported, or share the one admin account for now).

After creating the admin account and logging in, the dashboard shows a setup checklist:

1. **Connect a source** — point LatestArr at a running Tautulli, Plex, BookLore-family app, Audiobookshelf, or RomM instance and its API credentials. Use the **Test connection** button before saving; it calls the source's own API immediately rather than waiting for the first scheduled fetch to discover a bad URL or key.
2. **Add recipients and a group** — recipients are added individually (email + display name), then grouped, since a newsletter targets one or more groups rather than individual recipients directly.
3. **Configure an SMTP profile** — see [Deliverability](deliverability.md) for what to put in `defaultFromEmail`/`defaultFromName` and why. Use **Send test email** before wiring it to a real newsletter.
4. **(Optional) Design a template** — the drag-and-drop builder under Templates. Skip this and a newsletter falls back to a plain built-in layout; you can always come back and design one later.
5. **Create a newsletter** — pick a schedule (cron expression + timezone), lookback window, the source(s) and recipient group(s) to use, and optionally the template from step 4. **Send now** on the newsletter's detail page sends immediately without waiting for the schedule, useful for checking the result before trusting the automated send.

None of this is a separate wizard — it's the same admin screens you'd use afterward for day-to-day management, just presented in a sensible first-run order.

## Running behind a reverse proxy

LatestArr's container serves plain HTTP on port 3000 and expects TLS termination to happen in front of it (nginx, Caddy, Traefik, or your platform's own ingress). Two things to get right:

- Forward the real client IP and proto (`X-Forwarded-For`, `X-Forwarded-Proto`) so login rate-limiting and secure-cookie behavior work correctly.
- Set `WEB_ORIGIN` to the externally-reachable `https://` URL — the app only sets the session cookie's `Secure` flag when `NODE_ENV=production` (already set inside the container) and trusts the proxy for the rest.

A minimal Caddy example:

```
newsletter.example.com {
    reverse_proxy localhost:3000
}
```

## Setting up OIDC/SSO

LatestArr speaks generic OIDC via PKCE, so any standards-compliant provider works — this has been used with Authelia, Authentik, and Keycloak. Register a confidential client with your provider and set:

- `OIDC_ISSUER` — the provider's issuer URL (its OIDC discovery document must be reachable at `<issuer>/.well-known/openid-configuration`).
- `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` — from the client you registered.
- `OIDC_REDIRECT_URI` — `<your WEB_ORIGIN>/api/auth/oidc/callback`, and this exact URL must also be registered as an allowed redirect URI with your provider.
- `OIDC_SCOPES` (optional) — defaults to `openid profile email`, which is enough for most providers.

Local username/password login stays available alongside OIDC once it's configured — enabling SSO doesn't disable the account you bootstrapped with.

## Backups and upgrades

**Back up**: the `latestarr-data` volume (the entire SQLite database) and your `ENCRYPTION_KEY`. Losing the key while keeping the database means every encrypted credential in it is unrecoverable; losing the volume without the key is just a normal "restore from backup."

**Upgrade**: pull the new image tag and `docker compose up -d` again — migrations run automatically against the existing database on container start, and there's no separate migration step to run by hand. Read the relevant [`CHANGELOG.md`](../CHANGELOG.md) entries first if you're skipping several versions.
