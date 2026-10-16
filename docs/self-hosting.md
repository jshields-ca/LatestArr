# Self-hosting LatestArr

> The friendly, step-by-step guides are at **[latestarr.app/docs](https://www.latestarr.app/docs)**. This file is the technical reference that ships with the code: every setting, default and command in one page.

From a fresh install to a first sent newsletter. The [README's Quick start](../README.md#quick-start) is the short version of steps 1–3.

## 1. Prerequisites

- **Docker**, with Compose or another way to run one container with a persistent volume (Portainer, `docker run`).
- **A 64-bit host:** `linux/amd64` or `linux/arm64`, such as Apple Silicon or a Raspberry Pi 4 or 5 on a 64-bit OS. 32-bit ARM isn't supported.
- **At least one source** LatestArr can reach: Tautulli, Plex, Jellyfin, Emby, a BookLore-family app, Audiobookshelf or RomM. See [Supported sources](../README.md#supported-sources).
- **An SMTP server or provider** to send from. See [Deliverability](deliverability.md) for keeping digests out of spam.
- **For internet access only:** a reverse proxy with HTTPS. LatestArr itself only serves plain HTTP. See [Running behind a reverse proxy](#running-behind-a-reverse-proxy).

## 2. Configure

```bash
cp .env.example .env
```

Set **`ENCRYPTION_KEY`**, the only required setting. It encrypts the credentials LatestArr stores: source API keys and tokens, SMTP passwords and webhook URLs.

```bash
openssl rand -base64 32
```

Keep a copy somewhere other than `.env`, such as a password manager. Backups don't include it. Without it, those stored credentials can't be read and have to be entered again.

Everything else is optional. These are the settings most installs touch:

| Variable | Default | Set it when |
| --- | --- | --- |
| `WEB_ORIGIN` | `http://localhost:3000` | You open LatestArr at any other address. Password reset links and SSO sign-ins use it. |
| `PORT` | `3000` | Port 3000 is taken on the host. Update `WEB_ORIGIN` to match. |
| `TZ` | `UTC` | You want the daily backup at 3:00 AM your time, e.g. `America/Winnipeg`. |
| `TRUST_PROXY` | off | LatestArr is behind a reverse proxy. See [below](#running-behind-a-reverse-proxy). |
| `BACKUP_PATH` | `/app/data/backups` | Backups should go to another disk or a NAS. See [Backups](#backups). |
| `LATESTARR_VERSION` | `latest` | You want to pin a version, e.g. `v0.12.0`. |
| `LOG_LEVEL` | `info` | You want more (`debug`) or less (`warn`) detail. See [Logs](#logs). |
| `OIDC_*` | blank | You want SSO. See [Setting up OIDC/SSO](#setting-up-oidcsso). |

[`.env.example`](../.env.example) documents every variable.

## 3. Start the container

```bash
docker compose pull
docker compose up -d
```

- **The image:** `ghcr.io/jshields-ca/latestarr`. Every tagged release is published there for `amd64` and `arm64`, and Docker picks the right one. `:latest` is the newest release, not the newest commit.
- **What runs:** one container on port `3000`, with the SQLite database in the `latestarr-data` volume at `/app/data`. There's no separate database or cache to run.
- **Building it yourself** (contributors): `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build` builds from [`docker/Dockerfile`](../docker/Dockerfile).

### Without Compose

```bash
docker run -d \
  -p 3000:3000 \
  -e ENCRYPTION_KEY="your-saved-key" \
  -v latestarr-data:/app/data \
  --restart unless-stopped \
  --name latestarr \
  ghcr.io/jshields-ca/latestarr:latest
```

Use the same `ENCRYPTION_KEY` every time you recreate the container.

### Portainer, or any one-file setup

To paste a stack into Portainer (**Stacks → Add stack → Web editor**), or anywhere else without the `.env` file, use this with your own key and address:

```yaml
services:
  latestarr:
    container_name: latestarr
    image: ghcr.io/jshields-ca/latestarr:latest
    ports:
      - "3000:3000"
    environment:
      ENCRYPTION_KEY: "paste-your-key-here"   # openssl rand -base64 32; keep a copy
      WEB_ORIGIN: "http://localhost:3000"     # the address you open LatestArr at
      TZ: "America/Winnipeg"                  # so the daily backup runs at 3:00 AM your time
    volumes:
      - latestarr-data:/app/data
    restart: unless-stopped

volumes:
  latestarr-data:
```

- **More settings:** any variable from [`.env.example`](../.env.example) goes under `environment` the same way.
- **Keeping the key out of the stack:** write `ENCRYPTION_KEY: ${ENCRYPTION_KEY}` and set it under **Environment variables** in Portainer.
- **Updating:** **Pull and redeploy** on the stack.

## 4. First run

Open `http://localhost:3000`, or wherever you've exposed it, and create the admin account. That form only appears while there are no users; add everyone else from the **Users** page.

The dashboard's setup checklist then walks through the same pages you'll use day to day:

1. **Connect a source.** Enter its credentials and two addresses, then use **Test connection** before saving:
   - **Base URL:** where LatestArr connects. It only has to work from LatestArr's server, so a local address is fine.
   - **Public URL** (optional): where recipients go when they click an item or a Where to watch button. Left blank, item links use the Base URL and there's no Where to watch button. **Tautulli** is the exception: its address isn't one recipients can use, so without a Public URL its items have no links. For Plex and Tautulli, `https://app.plex.tv` works for anyone you share your server with; no domain of your own is needed.
   - **BookLore, BookOrbit and Grimmory** use an OPDS account, not your normal sign-in. Create one in the app's settings, under OPDS. Audio-only items (e.g. BookOrbit audiobooks) show as audiobooks.
2. **Add recipients and a group.** Add people one at a time, import your source's users, or [import a list](#importing-recipients). A newsletter sends to groups, not to individual people.
3. **Configure SMTP.** Add an SMTP profile and use **Send test email**. Set **From name** and **From email** as described in [Deliverability](deliverability.md).
4. **Choose a design** (optional). Duplicate the built-in **Default** and change it with a live preview, or use **Edit as code** for hand-written MJML. Newsletters use Default until you choose another.
5. **Create a newsletter.** Choose:
   - its schedule, a simple one (**Repeats**) or a cron expression, and a timezone;
   - how many days back to look for new items (**Lookback**);
   - its sources and recipient groups;
   - optionally, a design and a [subject](#subject-variables).

   **Preview** shows the next issue and can **Send test** to one address. **Send now** sends to everyone straight away.
6. **Get failure alerts.** See [Failure alerts](#failure-alerts).
7. **Add another admin**, so someone can reset your password if you forget it. See [Locked out?](#locked-out).

### Importing recipients

On the **Recipients** page, **Import** takes a pasted list, a CSV, or an Excel file (`.xlsx`, first sheet only; `.xls` isn't supported). **Download a template** gives you a starting file. Up to 1,000 rows at a time.

- **With a heading row,** columns are matched by name, in any order and ignoring case:
  - email (required): `Email`, `E-mail` or `Email address`;
  - name: `Name`, `Full name` or `Display name`;
  - groups: `Groups` or `Group`, with several separated by `;`.

  Other columns are ignored.
- **Without headings,** use one person per line: `jane@example.com`, `jane@example.com, Jane`, or `Jane <jane@example.com>`.

**Review** shows the result before anything is saved: new people, changed names, groups to create and join, and skipped rows with the reason. Groups are matched by name and created if missing. An import never removes anyone from a group.

**Undo last import** is available for 24 hours, or until the next import. It removes the people and groups the import added, takes people out of groups it added them to, and restores names it changed. Anything changed since is kept, and Undo tells you what.

### Subject variables

A subject can include these variables, filled in on each send in the newsletter's timezone:

| Variable | Example |
| --- | --- |
| `{newsletter}` | the newsletter's name |
| `{date}` | September 29, 2026 |
| `{shortDate}` | Sep 29 |
| `{period}` | Sep 22 – 29, 2026 |
| `{month}`, `{year}` | September, 2026 |
| `{count}` | 12 (new items) |
| `{counts}` | 8 movies, 4 episodes |

For example, `{count} new from {period}`. **Insert a variable** adds one, and the line under the field previews the next subject. A misspelled variable is refused when you save. A blank subject uses the newsletter's name.

## Running behind a reverse proxy

LatestArr serves plain HTTP on port 3000. Put a reverse proxy in front of it for HTTPS (Caddy, nginx, Traefik, or your platform's ingress), and:

1. **Pass the original `Host` header through.** LatestArr only accepts sign-ins and changes when the browser's address matches the `Host` it receives (its CSRF check). If the proxy rewrites `Host`, every sign-in fails with "Cross-origin request rejected". Caddy and Traefik keep it by default; nginx needs `proxy_set_header Host $host;`.
2. **Forward the client's address and protocol** with `X-Forwarded-For` and `X-Forwarded-Proto`. Most proxies do by default.
3. **Set `TRUST_PROXY=true`.** LatestArr then reads those headers, so:
   - the session cookie is marked `Secure`;
   - sign-in limits and the Logs page see each person's own IP, not the proxy's.

   Leave it unset when nothing sits in front of LatestArr. Otherwise anyone could fake their IP with a header and get round the sign-in limit.
4. **Set `WEB_ORIGIN`** to the `https://` address people use. Password sign-in doesn't depend on it, but SSO and password reset links do.

Caddy:

```
newsletter.example.com {
    reverse_proxy localhost:3000
}
```

nginx (inside your `server { ... }` block for HTTPS):

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Exposing LatestArr to the internet

LatestArr is built to be reachable from the internet. Your part:

- **Always use HTTPS,** through a [reverse proxy](#running-behind-a-reverse-proxy) with `TRUST_PROXY=true`. Never publish port 3000 directly.
- **Use strong passwords, or SSO.** Passwords need at least 12 characters. Sign-in allows 10 attempts a minute per IP, and failed attempts show on the Logs page.
- **Keep `ENCRYPTION_KEY` secret and backed up.**
- **Keep LatestArr updated.** Security fixes only go into the latest release; see [SECURITY.md](../SECURITY.md).

What LatestArr does:

- **Sign-in required everywhere** except signing in and out (including SSO), first-run setup, password reset by email, and the version and health checks. A test checks every route, so a new one can't be left open by accident.
- **Sessions** are random tokens, stored hashed, in `HttpOnly`, `SameSite=Lax` cookies. Deactivating a user or resetting their password signs them out everywhere.
- **CSRF protection:** changes are only accepted from LatestArr's own pages. Responses carry a strict Content Security Policy and other security headers.
- **Temporary passwords** can only be used to choose a new one.
- **Non-root:** the container runs as the unprivileged `node` user.
- **No leaks in errors or logs:** server errors are logged in full but never sent to the browser, and passwords, API keys and tokens are never logged.
- **Limits on sources:** requests time out after 30 seconds and images are capped at 20 MB, so a broken or hostile source can't hang a send.

**Internal addresses are allowed on purpose.** Sources, SMTP servers and webhooks are usually on your own network, so admins can point LatestArr at internal addresses, and **Test connection** shows whether they answer. Give admin accounts only to people you trust with your network.

## Setting up OIDC/SSO

LatestArr works with any standard OIDC provider, using PKCE. It's been used with Authelia, Authentik and Keycloak. Register a confidential client with your provider, then set:

| Variable | Value |
| --- | --- |
| `OIDC_ISSUER` | The provider's issuer URL. `<issuer>/.well-known/openid-configuration` must be reachable. |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | From the client you registered. |
| `OIDC_REDIRECT_URI` | `<your WEB_ORIGIN>/api/auth/oidc/callback`, registered with the provider as an allowed redirect URI. |
| `OIDC_SCOPES` | Optional. Defaults to `openid profile email`. |

Password sign-in stays available alongside SSO.

- **Letting someone in with SSO:** add them on the **Users** page with the email their provider uses, and leave the password blank. Their first SSO sign-in links to that account if the provider marks the email as verified (`email_verified`). SSO never creates accounts by itself.
- **Linking an existing account:** sign in with your password, open your profile (the pencil by your name) and choose **Link SSO**. This works whatever email the provider has, verified or not. **Unlink SSO** is there too, for accounts that also have a password.
- **Signing in from another address,** such as the LAN IP: your provider always returns you to `OIDC_REDIRECT_URI`, so **Continue with SSO** first moves you to that address, and you're signed in there.
- **If SSO doesn't sign you in,** the sign-in page says why, and the Logs page has the detail, for example an unverified email, or no account with that email.

## Users

The **Users** page lists everyone who can sign in, with their role. Only admins can open it.

| Role | Can |
| --- | --- |
| **Viewer** | See newsletters, designs, previews, send history (without recipients' addresses), and which sources are connected. Can't change anything. |
| **Editor** | Everything a viewer can, plus create, edit and delete newsletters and designs, send newsletters and tests, and manage recipients and groups. |
| **Admin** | Everything, including sources, SMTP profiles, notifications, users, backups and logs. |

Pages and buttons a role can't use are hidden, and the server refuses those requests too. On the Users page you can:

- **Add a user** with a role (viewer unless you choose otherwise) and a temporary password you give them yourself. They choose their own password at first sign-in. Leave the password blank for SSO-only users.
- **Change a role.** It applies from their next click, without signing in again.
- **Reset a password** to a new temporary one. This signs them out everywhere.
- **Deactivate** someone to sign them out and block sign-in, or **reactivate** them later.
- **Delete** a user. Designs they made are kept.

You can't deactivate, delete or change the role of your own account, and the last active admin can't be removed. Change your own name or password with the pencil button in the header.

## Locked out?

Forgotten your password? From the easiest fix to the last resort:

1. **Ask another admin** to use **Reset password** on the **Users** page. You get a temporary password and choose your own at your next sign-in.
2. **Use "Forgot password?"** on the sign-in page. It emails a link that works once, for 30 minutes. It only appears when:
   - an admin has chosen a **System email** profile on the **SMTP Profiles** page;
   - `WEB_ORIGIN` matches the address you use. If it doesn't, the links would be broken, and the SMTP Profiles page says so.

   The page gives the same answer whether or not the email has an account, and sends an account at most one email every couple of minutes.
3. **Run the recovery command on the server.** It works without email. Running commands on the host already means you control the install, so that's the proof of ownership.

   ```bash
   docker exec -it latestarr node dist/cli.js reset-password --email you@example.com
   ```

   It asks for the new password twice, without showing it. It then signs that account out everywhere and reactivates it if it was deactivated. Nothing secret is printed, and it's recorded on the Logs page.
   - **From a script:** `printf %s "$PASSWORD" | docker exec -i latestarr node dist/cli.js reset-password --email you@example.com --password-stdin`
   - **Forgotten the email?** `docker exec -it latestarr node dist/cli.js list-admins`

**Signing in with SSO?** Reset your password with your SSO provider. If the provider is down, the recovery command can give your account a password.

## Logs

The **Logs** page shows recent server activity, newest first. Expand an entry to see its details. It includes:

- every newsletter send (manual, scheduled, or caught up after downtime) and how many people it reached;
- recipients that couldn't be delivered to, and sources that couldn't be reached;
- sign-ins and failed sign-ins;
- changes to newsletters, recipients and settings, with the person who made them.

The same lines go to `docker logs latestarr`. The page keeps the latest 500 entries in memory, so it starts empty after a restart.

`LOG_LEVEL` sets the detail: `info` (the default), `debug` (adds per-source item counts for each send) or `warn` (problems only). Passwords, API keys and email contents are never logged.

## Failure alerts

The **Notifications** page can alert you when:

- a scheduled send fails, including a newsletter that can't send at all;
- a scheduled send only reaches some recipients;
- a backup fails, scheduled or manual.

All three are on by default, but nothing is sent until you turn on a destination: email through one of your SMTP profiles, a webhook (Discord, Slack, ntfy, Apprise or generic JSON), or both. **Send test alert** checks them before you rely on them.

- **Send now doesn't alert,** since you see its result yourself.
- **At most one alert an hour** per newsletter, and one an hour for backups.
- **Prefer a webhook** if you can. When the mail server is the problem, an email alert can't get through either.

## When a send doesn't reach everyone

**If LatestArr stops mid-send** (a crash, a restart or an upgrade), it closes that send when it next starts:

- The newsletter's **History** shows who got it. The send is marked partly sent, or failed if nobody got it, and you're alerted.
- It isn't resent automatically. Missed-send catch-up counts it as that period's send, so nobody gets a duplicate.

**Send to the rest** finishes a partly sent newsletter, whatever the cause: LatestArr stopped, the mail server turned some people away, or a rate limit cut it off. Open the send's **Details** in **History** and choose it.

- **What it sends:** the same email, with the same items, subject and images.
- **Who gets it:**
  - only people who didn't get it, including failed deliveries, for example after you fix an SMTP setting;
  - anyone added to the newsletter's groups since;
  - not anyone deactivated since.

  The confirmation shows how many people, and who.
- **The result:** their results are added to the same send, which counts as sent once everyone has it.
- **Who can use it:** editors and admins. Each use is logged.
- **Which send:** only the newsletter's latest send, while it's within the lookback window. After that, use **Send now**.
- **One possible duplicate:** if LatestArr stopped mid-send, the person it was sending to at that moment may have got the email without it being recorded.
- **Storage:** LatestArr keeps each newsletter's latest send's images so it can send them again. They're removed when the next send goes out.

## Backups

By default, LatestArr backs up its database every day at 3:00 AM and keeps the last seven. The time is in `TZ`, or UTC if that's unset. On the **Backups** page (admins only) you can change the schedule and what's kept, **Back up now**, and download or delete backups.

- **One `.zip` file each,** named like `latestarr-backup-20260929T030000Z-v0.12.0-scheduled.zip`. It holds the database and a `manifest.json`, with the version, time, item counts, and a fingerprint of your key, never the key itself.
- **Safe while running:** backups use SQLite's online backup and pass SQLite's integrity check before they're kept. A failed backup shows on the Backups and Logs pages, and alerts you if you've turned that on.
- **Retention:** keep the latest _N_, or the newest from each of the last few days, weeks and months. Old backups are only removed after a new one succeeds, and the newest is always kept.
- **Before upgrades:** a new version backs up first, the first time it starts on your database ("Before upgrade"). The last three of those are kept regardless of retention.

**Where they go.** By default `/app/data/backups`, on the same volume as the database, so one failed disk takes both. To keep them elsewhere, mount another disk or a NAS share and set `BACKUP_PATH`:

```yaml
services:
  latestarr:
    environment:
      BACKUP_PATH: /backups
    volumes:
      - latestarr-data:/app/data
      - /mnt/nas/latestarr-backups:/backups
```

LatestArr's `node` user (UID 1000) must be able to write there. The container sets that up when it starts, where the filesystem allows. If it can't, a backup fails with an error naming the folder, linked to [how to fix it](https://www.latestarr.app/docs/backups#cant-write).

**Keep `ENCRYPTION_KEY` separately.** Backups leave it out on purpose. Without it, a restored backup works, but its source and SMTP credentials and webhook URLs have to be entered again.

**Backups are sensitive.** They hold every recipient's email address and your send history. Only admins can download them, and each download is logged.

### Restoring a backup

The recovery command checks a backup and swaps it in the next time LatestArr starts. Your current database is kept beside it as `latestarr.db.before-restore-<time>`.

1. **Check it** (optional): `docker exec -it latestarr node dist/cli.js check-backup <file>`. This shows when it was made, by which version, what it holds, and whether it matches this server's `ENCRYPTION_KEY`.
2. **Restore it:** `docker exec -it latestarr node dist/cli.js restore <file>`. `<file>` is a name from the Backups page, or a path inside the container.
3. **Restart:** `docker restart latestarr`.

For a backup you downloaded, copy it into the backup folder first: `docker cp latestarr-backup-….zip latestarr:/app/data/backups/`.

- **Made with a different key:** the restore stops and explains. Set `ENCRYPTION_KEY` to the key of the install the backup came from, restart, and run it again. Or add `--ignore-key-mismatch` and enter the credentials again afterwards. LatestArr also warns at startup when its key can't read the stored credentials.
- **Made by a newer version:** it won't restore on an older one. Upgrade first.
- **Changed your mind before restarting?** `docker exec -it latestarr node dist/cli.js restore --cancel`.
- **If the container won't start at all:** stop it, unzip the backup, and put its `latestarr.db` in place of the one in the data volume. Delete `latestarr.db-wal` and `latestarr.db-shm` beside it, then start the container.

## Upgrading

```bash
docker compose pull
docker compose up -d
```

In Portainer, use **Pull and redeploy**. On start, LatestArr [backs up](#backups) the database, then migrates it, with nothing to run by hand. If you're skipping several versions, read their [release notes](https://github.com/jshields-ca/LatestArr/releases) first. To stay on one version, set `LATESTARR_VERSION`, e.g. `v0.12.0`.
