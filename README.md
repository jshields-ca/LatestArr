# LatestArr

[![Version](https://img.shields.io/github/package-json/v/jshields-ca/latestarr?label=version)](https://github.com/jshields-ca/latestarr/releases)
[![CI](https://github.com/jshields-ca/latestarr/actions/workflows/ci.yml/badge.svg)](https://github.com/jshields-ca/latestarr/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-latestarr.app-c31d4c)](https://www.latestarr.app/docs)
[![Discussions](https://img.shields.io/github/discussions/jshields-ca/latestarr?label=discussions)](https://github.com/jshields-ca/LatestArr/discussions)
[![License: GPL v3](https://img.shields.io/badge/license-GPLv3-blue.svg)](LICENSE)
[![Sponsor](https://img.shields.io/badge/sponsor-%E2%9D%A4-ef5d86)](https://github.com/sponsors/jshields-ca)

**A self-hosted "what's new" newsletter for your media server.** LatestArr connects to Plex, Tautulli, Jellyfin, Emby, and your book, audiobook, and game libraries. It collects everything added recently and emails your users a clean, branded digest on a schedule you choose.

**[Website](https://www.latestarr.app)** · **[Docs](https://www.latestarr.app/docs)** · **[Install](https://www.latestarr.app/docs/installation)** · **[Discussions](https://github.com/jshields-ca/LatestArr/discussions)** · **[Releases](https://github.com/jshields-ca/LatestArr/releases)**

<img src="docs/assets/social-preview.png" alt="LatestArr: self-hosted digest newsletters for Plex, books, audiobooks and games" width="100%" />

> [!WARNING]
> **Early days, in active development.** LatestArr is pre-1.0. It's usable today, but expect rough edges, and an update may occasionally change how something works. Back up your data and `ENCRYPTION_KEY` before you update, and read the [release notes](https://github.com/jshields-ca/LatestArr/releases). See [Project status](#project-status) for the known gaps.

## Why LatestArr?

[Tautulli](https://tautulli.com/)'s newsletter, the closest existing tool, only speaks to Plex and gives you limited control over layout, scheduling, and branding. LatestArr is Plex-aware but not Plex-only, and you design the email yourself. The goal is simple: give something genuinely useful back to the *arr community.

## Features

- **Many sources, one newsletter.** Plex, Tautulli, Jellyfin, Emby, BookLore-family book libraries, Audiobookshelf, and RomM. Mix them in one newsletter or give each its own, and import your server's users as recipients.
- **Design without code, or with it.** Pick fonts, colours, layout (cards, compact list, or grid), and what each item shows, with a live preview. Group items by type, fold a show's new episodes into one row, and add an intro, a footer note, and buttons. Switch to **code mode** (MJML) for full control.
- **Where to watch.** Each item links to your server, and **Watch on Plex**-style buttons point people to the right place.
- **Your schedule.** As many newsletters as you like, each with its own schedule, timezone, lookback window, sources, and recipient groups. Missed sends catch up, and a send with nothing new can be skipped.
- **Check before it goes out.** Preview the next issue with real items, and send yourself a test.
- **Know when it fails.** Alerts by email, Discord, Slack, ntfy, Apprise, or JSON webhook, and a Logs page that shows what happened.
- **Good delivery habits.** Sends through your own mail server or provider, one message per recipient, with posters embedded and a plain-text version. Dark-mode aware.
- **Built to be exposed.** Local accounts or SSO (OIDC), several admins, encrypted credentials, rate limiting, CSRF protection, and a strict CSP. Runs as a non-root container.
- **Accessible.** Automated accessibility checks on every change, and it works by keyboard and on your phone.

## Supported sources

| Source | Content | Connects via | Status |
| --- | --- | --- | --- |
| [Tautulli](https://tautulli.com/) | Movies, TV | Tautulli API | ✅ Working |
| Plex (direct) | Movies, TV | Plex API | 🧪 [Needs testers](https://github.com/jshields-ca/LatestArr/issues/244) |
| [Jellyfin](https://jellyfin.org/) | Movies, TV, books, audiobooks | Jellyfin API | 🧪 [Needs testers](https://github.com/jshields-ca/LatestArr/issues/196) |
| [Emby](https://emby.media/) | Movies, TV, books, audiobooks | Emby API | 🧪 [Needs testers](https://github.com/jshields-ca/LatestArr/issues/196) |
| [BookLore](https://github.com/booklore-app/booklore) | Books | OPDS | 🧪 [Needs testers](https://github.com/jshields-ca/LatestArr/issues/244) |
| [BookOrbit](https://github.com/bookorbit/bookorbit) | Books | OPDS | ✅ Working |
| [Grimmory](https://github.com/grimmory-tools/grimmory) | Books | OPDS | 🧪 [Needs testers](https://github.com/jshields-ca/LatestArr/issues/244) |
| [Audiobookshelf](https://www.audiobookshelf.org/) | Audiobooks, podcasts | Audiobookshelf API | 🧪 [Needs testers](https://github.com/jshields-ca/LatestArr/issues/244) |
| [RomM](https://github.com/rommapp/romm) | Games | RomM API | ✅ Working |
| Kavita, Komga, Calibre-Web, Immich, ... | Various | | Under consideration: [request one](https://github.com/jshields-ca/LatestArr/issues/new?template=adapter_request.yml) |

Each source has a setup guide in the [docs](https://www.latestarr.app/docs/sources). BookLore, BookOrbit, and Grimmory are separate apps from a common lineage that share the same [OPDS](https://opds.io/) catalog feed, so one adapter covers all three.

> [!TIP]
> **Help test the 🧪 sources.** They're built from each app's published API and covered by tests, but haven't been confirmed on a real server yet. If you run one, add it as a source, send yourself a test newsletter, and tell us how it went: [Jellyfin and Emby](https://github.com/jshields-ca/LatestArr/issues/196), or [Plex (direct), BookLore, Grimmory, and Audiobookshelf](https://github.com/jshields-ca/LatestArr/issues/244). Include your server version, what worked, and any errors from the **Logs** page. Each moves to ✅ once someone confirms it works.

## Quick start

You'll need Docker with Compose, at least one supported source the container can reach, and an SMTP server or provider to send from. Everything runs in one container, with no separate database to set up.

```bash
# Get docker-compose.yml and .env.example from this repository, then:
cp .env.example .env
# Set ENCRYPTION_KEY in .env (generate one with: openssl rand -base64 32)
docker compose pull
docker compose up -d
```

Open `http://localhost:3000`, create the admin account, and follow the checklist on the dashboard: connect a source, add recipients, set up SMTP, and create your first newsletter.

- **Keep a copy of `ENCRYPTION_KEY`** somewhere other than `.env`. Without it, the credentials stored in the database can't be read.
- Before sending to real people, read [Deliverability](https://www.latestarr.app/docs/email-delivery/deliverability) (SPF, DKIM, and DMARC), or your digests may land in spam.
- Exposing it to the internet? Put it behind a [reverse proxy with HTTPS](https://www.latestarr.app/docs/installation/reverse-proxy). It works just as well on your LAN or a VPN; only your SMTP server needs to reach recipients.

**Upgrading:** back up the `latestarr-data` volume and your key, then `docker compose pull && docker compose up -d`. Migrations run automatically. See [Upgrading and backups](https://www.latestarr.app/docs/installation/upgrading).

## Documentation

The full docs live at **[latestarr.app/docs](https://www.latestarr.app/docs)**:

- [Installation](https://www.latestarr.app/docs/installation), [environment variables](https://www.latestarr.app/docs/installation/environment-variables), and [reverse proxy and HTTPS](https://www.latestarr.app/docs/installation/reverse-proxy)
- [Sources](https://www.latestarr.app/docs/sources) and [importing users](https://www.latestarr.app/docs/sources/importing-users)
- [Newsletters](https://www.latestarr.app/docs/newsletters), [designs](https://www.latestarr.app/docs/designs), and [code mode](https://www.latestarr.app/docs/designs/code-mode)
- [Email delivery](https://www.latestarr.app/docs/email-delivery), [notifications](https://www.latestarr.app/docs/notifications), and [logs and troubleshooting](https://www.latestarr.app/docs/logs-and-troubleshooting)
- [Users](https://www.latestarr.app/docs/users), [security](https://www.latestarr.app/docs/security), and [SSO with OIDC](https://www.latestarr.app/docs/security/sso)
- [FAQ](https://www.latestarr.app/docs/faq)

This repository keeps [`docs/self-hosting.md`](docs/self-hosting.md) and [`docs/deliverability.md`](docs/deliverability.md) as offline copies of the essentials, and [`.env.example`](.env.example) lists every setting.

## Project status

- **Pre-1.0.** Usable today, with rough edges and occasional breaking changes. Back up before updating.
- **Limited real-world testing.** Testing so far is the maintainer's own setup; the 🧪 sources above still need testers.
- **Known gaps:** no unsubscribe link yet (an admin deactivates recipients instead; see [Unsubscribe](https://www.latestarr.app/docs/email-delivery/unsubscribe)), every user is a full admin until [roles](https://github.com/jshields-ca/LatestArr/issues/257) land, and Gmail's mobile apps apply their own dark mode.

## How it's built

AI is LatestArr's lead developer: the code, tests, CI, and docs are written by [Claude Code](https://claude.com/claude-code), Anthropic's AI coding agent. A human maintainer directs the work, reviews every change before it merges, and tests releases on a real setup. That's worth knowing before you self-host a tool that holds credentials and may face the internet.

What keeps it honest:

- **Automated checks on every change:** lint, typecheck, build, and tests (including axe-core accessibility checks) on Node 24 and 26, plus a Docker build and smoke test, all required to pass in CI.
- **Real-world testing:** UI changes are checked in a real browser, and releases run against the maintainer's own media servers. Where that isn't possible, the sources table marks it 🧪 Needs testers.
- **Security by design:** credentials encrypted at rest, server-side sessions, rate limiting, CSRF protection, and input validation on every route, with a test that every route needs a signed-in user unless it's meant to be public. Dependabot and CodeQL run continuously. See [Security](https://www.latestarr.app/docs/security).

None of this makes it bug-free. Treat AI authorship as a reason to read the code before trusting it with sensitive data, the same care you'd give any early-stage open-source project.

## Community and support

- **Questions, ideas, and show-and-tell:** [GitHub Discussions](https://github.com/jshields-ca/LatestArr/discussions). Ask how to set something up, share a design, suggest a feature, or report how a 🧪 source worked for you.
- **Bugs and concrete feature requests:** [open an issue](https://github.com/jshields-ca/LatestArr/issues/new/choose).
- **Security problems:** report them privately, as described in [`SECURITY.md`](SECURITY.md). Please don't open a public issue.

## Contributing

Outside eyes make LatestArr better, and code isn't the only way to help:

- **Review the code**, especially anything touching security, credentials, or email handling.
- **Test sources**, above all the 🧪 ones, or any source on a setup unlike ours.
- **Tell us what's missing** on reliability, security, and maturity.

To contribute code, see [`CONTRIBUTING.md`](CONTRIBUTING.md) for the dev setup, standards, and how to add a source adapter, and read the [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

If you'd like to support development, [GitHub Sponsors](https://github.com/sponsors/jshields-ca) is open, and a star on the repo helps others find it.

## Star history

<a href="https://star-history.com/#jshields-ca/LatestArr&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=jshields-ca/LatestArr&type=Date&theme=dark" />
    <img alt="LatestArr's GitHub stars over time" src="https://api.star-history.com/svg?repos=jshields-ca/LatestArr&type=Date" />
  </picture>
</a>

## License

LatestArr is licensed under the [GNU General Public License v3.0](LICENSE). It's a copyleft license: if you distribute a modified version of LatestArr (including as a fork, or a hosted service that distributes the code), your version must also be licensed under GPLv3 with its source available. Third-party dependencies under permissive licenses (such as MIT) are used as libraries and don't change that for LatestArr's own code.

The Sources page's service logos (Tautulli, Plex, Jellyfin, Emby, BookLore, BookOrbit, Grimmory, Audiobookshelf, RomM) are bundled from [selfh.st/icons](https://selfh.st/icons) under [CC BY 4.0](https://github.com/selfhst/icons/blob/main/LICENSE). See [`apps/web/src/assets/logos/NOTICE.md`](apps/web/src/assets/logos/NOTICE.md) for per-file attribution. Each logo is a trademark of its project, used only to identify that source, not to imply endorsement.

---

© 2026 LatestArr contributors. Led and maintained by [Jeremy Shields](https://www.jeremyshields.ca).
