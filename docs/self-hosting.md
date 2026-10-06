# Self-hosting LatestArr

> The full, up-to-date documentation is at **[latestarr.app/docs](https://www.latestarr.app/docs)**. This file is a single-page copy of the essentials that ships with the code.

A full walkthrough from a fresh checkout to a first sent newsletter. If you just want the fastest path, the [README's Quick start](../README.md#quick-start) section is the short version of steps 1–3 below.

## 1. Prerequisites

- Docker and Docker Compose (or a way to run a single container with a persistent volume, if you're not using Compose).
- At least one media server LatestArr can connect to (Tautulli, direct Plex, Jellyfin, Emby, a BookLore-family app, Audiobookshelf, or RomM) — see [Supported sources](../README.md#supported-sources).
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
- **`WEB_ORIGIN`** (optional) — the externally-reachable URL of this instance, e.g. `https://newsletter.example.com`. Matters if you're exposing this beyond `localhost`, enabling OIDC (some providers validate the redirect URI's origin), or using password reset emails (the links point here). Defaults to `http://localhost:3000`.
- The four `OIDC_*` variables (optional) — see [Setting up OIDC/SSO](#setting-up-oidcsso) below. Leave all four blank for local username/password auth only, which is the default and requires no configuration.

Every variable is documented in [`.env.example`](../.env.example).

## 3. Start the container

```bash
docker compose pull   # fetch the published image from ghcr.io
docker compose up -d
```

`docker-compose.yml` points at `ghcr.io/jshields-ca/latestarr` — every tagged release publishes an image there, and `:latest` always tracks the most recent release (not every commit to `main`). Skip `docker compose pull` and run `docker compose up -d --build` instead if you'd rather build from [`docker/Dockerfile`](../docker/Dockerfile) locally (e.g. testing a change of your own). Either way you end up with one container exposing port `3000`, with a named Docker volume (`latestarr-data`) holding the SQLite database at `/app/data`. Nothing else to stand up — no separate database or cache container.

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

Visit `http://localhost:3000` (or wherever you've exposed it). The first thing you'll see is an admin account creation form — this only appears when the database has zero users, and the endpoint that creates it refuses once one exists, so it can't be used to create a second admin later. Add more people from the **Users** page instead.

After creating the admin account and logging in, the dashboard shows a setup checklist:

1. **Connect a source** — point LatestArr at a running Tautulli, Plex, Jellyfin, Emby, BookLore-family app, Audiobookshelf, or RomM instance and its API credentials. Use the **Test connection** button before saving; it calls the source's own API immediately rather than waiting for the first scheduled fetch to discover a bad URL or key.
2. **Add recipients and a group** — recipients are added individually (email + display name), then grouped, since a newsletter targets one or more groups rather than individual recipients directly.
3. **Configure an SMTP profile** — see [Deliverability](deliverability.md) for what to put in `defaultFromEmail`/`defaultFromName` and why. Use **Send test email** before wiring it to a real newsletter.
4. **(Optional) Make a design** — under Designs, duplicate the built-in Default and change its colours, layout, and details, and add an intro, footer note, or buttons, with a live preview. **Edit as code** switches a design to hand-written MJML if you want full control. Skip this and a newsletter uses Default; you can always come back and design one later.
5. **Create a newsletter** — pick a schedule (cron expression + timezone), lookback window, the source(s) and recipient group(s) to use, and optionally the design from step 4. **Send now** on the newsletter's detail page sends immediately without waiting for the schedule, useful for checking the result before trusting the automated send.

None of this is a separate wizard — it's the same admin screens you'd use afterward for day-to-day management, just presented in a sensible first-run order.

## Running behind a reverse proxy

LatestArr's container serves plain HTTP on port 3000 and expects TLS termination to happen in front of it (nginx, Caddy, Traefik, or your platform's own ingress). Two things to get right:

- Forward the real client IP and proto (`X-Forwarded-For`, `X-Forwarded-Proto`) and set `TRUST_PROXY=true` in `.env` — without this, LatestArr ignores those headers (so it never knows the connection is actually HTTPS) and the session cookie's `Secure` flag won't be set, which login rate-limiting and secure-cookie behavior both depend on. Leave `TRUST_PROXY` unset for direct `http://` access with no proxy in front (the default Getting Started flow) — setting it without an actual proxy forwarding those headers lets a client spoof its own IP and protocol.
- Set `WEB_ORIGIN` to the externally-reachable `https://` URL.

A minimal Caddy example:

```
newsletter.example.com {
    reverse_proxy localhost:3000
}
```

## Exposing LatestArr to the internet

LatestArr is built to be reachable from the internet, but a few things are up to you:

- **Always use HTTPS**, through the reverse proxy above with `TRUST_PROXY=true`, so the session cookie is marked `Secure`. Never publish port 3000 directly.
- **Use strong passwords, or SSO.** Passwords must be at least 12 characters. Sign-in is limited to 10 attempts a minute per client IP, and failed attempts show on the Logs page.
- **Keep `ENCRYPTION_KEY` secret and backed up.** It protects every source, SMTP, and webhook credential stored in the database.
- **Keep the container updated.** Security fixes only go into the latest release (see [SECURITY.md](../SECURITY.md)).

What LatestArr does for you:

- Every API route except sign-in, first-run setup, and the version and health checks requires a signed-in user. A test checks this for every route, so a new route can't be left open by accident.
- Sessions are random tokens stored hashed, in `HttpOnly`, `SameSite=Lax` cookies. Deactivating a user or resetting their password signs them out everywhere.
- Changes are only accepted from the app's own origin (a CSRF defence), and responses carry a strict Content Security Policy and other security headers.
- Someone given a temporary password can do nothing but choose a new one.
- The container runs as an unprivileged user, not root.
- Server errors are logged in full but never sent to the browser, and passwords, API keys, and tokens are never logged.
- Requests to your sources time out after 30 seconds and images are capped at 20 MB, so a broken or hostile source can't hang a send.

**About internal addresses:** sources, SMTP servers, and webhooks are usually on your own network, so any signed-in user can point LatestArr at an internal address, and **Test connection** reports whether it answered. That's intended, but it's another reason to give accounts only to people you trust with your network.

## Setting up OIDC/SSO

LatestArr speaks generic OIDC via PKCE, so any standards-compliant provider works — this has been used with Authelia, Authentik, and Keycloak. Register a confidential client with your provider and set:

- `OIDC_ISSUER` — the provider's issuer URL (its OIDC discovery document must be reachable at `<issuer>/.well-known/openid-configuration`).
- `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` — from the client you registered.
- `OIDC_REDIRECT_URI` — `<your WEB_ORIGIN>/api/auth/oidc/callback`, and this exact URL must also be registered as an allowed redirect URI with your provider.
- `OIDC_SCOPES` (optional) — defaults to `openid profile email`, which is enough for most providers.

Local username/password login stays available alongside OIDC once it's configured — enabling SSO doesn't disable the account you bootstrapped with.

SSO never creates accounts by itself after the first one. To let someone in with SSO, add them on the **Users** page with the email address their provider uses, and leave the password blank. The first time they sign in with SSO, LatestArr links their SSO identity to that account, as long as the provider marks the email as verified (`email_verified`).

## Users

Everyone who can sign in is listed under **Users**, with their role. Only admins can open the page.

| Role | Can |
| --- | --- |
| **Viewer** | See newsletters, designs, previews, and send history (without recipients' email addresses), and which sources are connected. Can't change anything. |
| **Editor** | Everything a viewer can, plus create, edit, and delete newsletters and designs, send newsletters and tests, and manage recipients and groups. |
| **Admin** | Everything, including sources, SMTP profiles, notifications, users, and the Logs page. |

Pages and buttons someone's role doesn't allow are hidden, and the server refuses those requests as well. From the Users page you can:

- **Add a user** with a role and a temporary password you share with them yourself. They choose their own password the first time they sign in. Leave the password blank for someone who will only use SSO. New users are viewers unless you choose otherwise.
- **Change someone's role.** It takes effect on their next click; they don't need to sign in again.
- **Reset a password** to a new temporary one. This signs them out everywhere.
- **Deactivate** someone to sign them out at once and stop them signing in, or **reactivate** them later.
- **Delete** a user. Designs they created are kept.

You can't deactivate, delete, or change the role of your own account, and the last active admin can't be removed, so there's always at least one admin who can sign in. Change your own name or password from the pencil button in the header.

## Locked out?

If you've forgotten your password, from the most common case to the last resort:

1. **Ask another admin.** On the **Users** page they can **Reset password** for you. You get a temporary password, are signed out everywhere, and choose your own at your next sign-in. This is why the setup checklist suggests a second admin account.
2. **Use "Forgot password?" on the sign-in page.** It emails you a link that works once, for 30 minutes. It's only there once an admin has chosen a **System email** profile on the **SMTP Profiles** page, and `WEB_ORIGIN` matches the address you use for LatestArr (otherwise the links would be broken, and the SMTP Profiles page says so). Asking always gives the same answer, so it doesn't reveal which emails have accounts, and an account gets at most one email every couple of minutes.
3. **Use the recovery command on the server.** It works even without email. Anyone who can run commands on the host already controls the install, so that's the proof of ownership:

   ```bash
   docker exec -it latestarr node dist/cli.js reset-password --email you@example.com
   ```

   It asks you to type the new password twice, without showing it, then signs that account out everywhere and reactivates it if it was deactivated. Nothing secret is printed. For a script, pipe the password in instead: `printf %s "$PASSWORD" | docker exec -i latestarr node dist/cli.js reset-password --email you@example.com --password-stdin`. Forgotten which email you used? `docker exec -it latestarr node dist/cli.js list-admins` lists the admins. Both are recorded on the **Logs** page.

**Signing in with SSO?** Your password lives with your SSO provider, so reset it there. If the provider itself is down, the recovery command can give your account a password as well.

## Logs

The **Logs** page in the web UI shows the server's recent activity, newest first: every newsletter send (manual, scheduled, or caught up after downtime) with how many recipients it reached, recipients that couldn't be delivered to, sources that couldn't be reached, sign-ins and failed sign-in attempts, and each settings change along with the admin who made it. Expand an entry to see its details. The same lines go to `docker logs latestarr`.

The page keeps the most recent 500 entries in memory, so it starts empty after a restart. Set `LOG_LEVEL` in `.env` to change the detail: `debug` adds per-source item counts for each send, and `warn` keeps only problems. The default is `info`. Passwords, API keys, and email contents are never logged.

## Failure alerts

The **Notifications** page can alert you when a scheduled newsletter fails to send or only reaches some of its recipients: by email through one of your SMTP profiles, and/or through a webhook (Discord, Slack, ntfy, Apprise, or generic JSON). Manual **Send now** results don't alert, since you see those yourself, and alerts for the same newsletter are limited to one per hour. Use **Send test alert** to check a destination before saving. If the problem is your mail server, an email alert can't get through either, so a webhook is the more reliable choice.

**If LatestArr stops during a send** (a crash, a restart, an upgrade), it closes that send the next time it starts. The newsletter's **History** shows who got it before the stop, the send is marked partly sent (or failed, if nobody got it), and you're alerted. It isn't resent automatically, and missed-send catch-up counts it as that period's send, so nobody who already got it receives a duplicate. To reach the rest, use **Send now**, which goes to everyone, or wait for the next scheduled send.

## Backups

LatestArr backs up its database every day at 03:00 and keeps the last seven. Change the schedule and what's kept on the **Backups** page (admins only), where you can also **Back up now**, download, or delete a backup.

- **Each backup is one `.zip` file**, named like `latestarr-backup-20260929T030000Z-v0.12.0-scheduled.zip`. It holds the database and a `manifest.json` (version, time, item counts, and a fingerprint of your key, never the key itself).
- **Made while LatestArr runs**, using SQLite's online backup, and checked with SQLite's integrity check before it's kept. A backup that fails is reported on the Backups and Logs pages, and with a failure alert if you've set those up (Notifications → "A backup fails").
- **Retention** keeps either the most recent _N_, or the newest from each of the last few days, weeks, and months. Old backups are only removed after a new one succeeds, and the newest one is always kept.
- **Before an upgrade**, when a new version starts on your database for the first time, it backs up first (marked "Before upgrade"). The last three of those are kept regardless of retention, so an upgrade can always be undone.

**Where they go:** `/app/data/backups` by default, which is on the same volume as the database, so a failed disk takes both. Set `BACKUP_PATH` to a folder on another disk, a NAS mount, or somewhere your host's own backup tool already copies offsite:

```yaml
services:
  latestarr:
    environment:
      BACKUP_PATH: /backups
    volumes:
      - latestarr-data:/app/data
      - /mnt/nas/latestarr-backups:/backups
```

**Keep `ENCRYPTION_KEY` safe, separately.** Backups don't include it, on purpose. Without it, a restored backup's source and SMTP passwords can't be read (everything else still works, and you can enter those again).

**Backups are sensitive.** They hold every recipient's email address and your send history. Only admins can download them, and each download is logged.

### Restoring a backup

The recovery command checks a backup and swaps it in the next time LatestArr starts. Your current database is kept beside it, renamed `latestarr.db.before-restore-<time>`, in case you change your mind.

1. **Check it** (optional): `docker exec -it latestarr node dist/cli.js check-backup <file>`. This shows when it was made and by which version, what it contains, and whether it was made with this server's `ENCRYPTION_KEY`.
2. **Restore it:** `docker exec -it latestarr node dist/cli.js restore <file>`. `<file>` is a backup's name from the Backups page, or a path inside the container.
3. **Restart:** `docker restart latestarr`.

To restore a backup you downloaded, copy it into the backup folder first, e.g. `docker cp latestarr-backup-….zip latestarr:/app/data/backups/`.

- **A different key:** the restore stops and explains. Set `ENCRYPTION_KEY` to the key of the install the backup came from, restart, and run it again. Or add `--ignore-key-mismatch` and enter the sources' and SMTP profiles' credentials again afterwards. LatestArr also warns at startup when its key can't read the saved credentials.
- **A newer version:** a backup made by a newer LatestArr won't restore on an older one. Upgrade first.
- **Changed your mind before restarting?** `docker exec -it latestarr node dist/cli.js restore --cancel`.
- **Without the container** (it won't start at all): stop it, unzip the backup, and put its `latestarr.db` in place of the one in the data volume, removing `latestarr.db-wal` and `latestarr.db-shm` beside it. Then start it.

## Upgrading

Pull the new image tag and `docker compose up -d` again. Migrations run automatically when the container starts, right after the automatic pre-upgrade backup, so there's no separate step to run by hand. Read the relevant [`CHANGELOG.md`](../CHANGELOG.md) entries first if you're skipping several versions.
