# LatestArr

[![Version](https://img.shields.io/github/package-json/v/jshields-ca/latestarr?label=version)](https://github.com/jshields-ca/latestarr/releases)
[![CI](https://github.com/jshields-ca/latestarr/actions/workflows/ci.yml/badge.svg)](https://github.com/jshields-ca/latestarr/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/license-GPLv3-blue.svg)](LICENSE)
[![Sponsor](https://img.shields.io/badge/sponsor-%E2%9D%A4-ef5d86)](https://github.com/sponsors/jshields-ca)

<img src="docs/assets/social-preview.png" alt="LatestArr — self-hosted digest newsletters for Plex, books, audiobooks & games" width="100%" />

> **⚠️ Active testing and iteration.** LatestArr is pre-1.0 and changing fast — expect bugs, rough edges, and breaking changes between releases. It's usable today, but if you're testing it, back up your data first and don't treat it as a finished product yet. See [`CHANGELOG.md`](CHANGELOG.md) for what's changed recently and the [Issues](https://github.com/jshields-ca/latestarr/issues) page for known gaps.

**LatestArr** is a self-hosted, open-source "new content" newsletter tool for the self-hosted media ecosystem — the *arr stack and friends. It connects to your existing media servers, pulls in whatever movies, TV episodes, books, audiobooks, and games were recently added, and sends a fully custom-branded HTML digest to your users on a schedule you control.

It exists because [Tautulli](https://tautulli.com/)'s built-in newsletter feature — the closest existing tool to this — only speaks to Plex and offers limited control over layout, scheduling, and branding. LatestArr is a standalone tool, Plex-aware but not Plex-only, built around a drag-and-drop template editor so anyone can design their own newsletter without touching HTML or CSS.

## Why LatestArr?

- **Source-agnostic** — connect Plex/Tautulli, book libraries, audiobook servers, and game libraries, and mix them into one newsletter or split them across many.
- **No-code, drag-and-drop templates** — build your own layout from blocks (movie cards, book cards, headers, footers, ...) with full control over branding, CSS/HTML, and dynamic subject lines, no coding required.
- **Flexible scheduling** — every newsletter has its own schedule, lookback window, sources, and recipient list, with automatic catch-up if the server was down when a send was due.
- **Built for public exposure** — OIDC/SSO support, encrypted-at-rest credentials, security headers, rate limiting, CSRF protection, and input validation on every route, because self-hosted tools increasingly get exposed to the internet.
- **Accessible by default** — the admin UI is built on accessible-first components, tested against automated accessibility checks in CI, and manually verified keyboard-only, not bolted on after the fact.
- **Open source, GPLv3** — built to be forked, extended, and contributed to.

## How it works

1. **Connect a source** — Tautulli, direct Plex, a BookLore-family app, Audiobookshelf, or RomM. LatestArr polls it on a schedule for recently-added items.
2. **Design a template** (optional) — drag blocks onto a canvas to build your own layout, or skip this and use the built-in default.
3. **Set up recipients and SMTP** — group your recipients, connect an SMTP server to send from.
4. **Create a newsletter** — pick a schedule, a lookback window, which sources feed it, and who receives it. It sends itself from there.

## Supported sources

| Source | Content type | Connects via | Status |
| --- | --- | --- | --- |
| [Tautulli](https://tautulli.com/) | Movies, TV | Tautulli API | ✅ Implemented |
| Plex (direct) | Movies, TV | Plex API | ✅ Implemented |
| [BookLore](https://github.com/booklore-app/booklore) | Books | OPDS | ✅ Implemented |
| [BookOrbit](https://github.com/bookorbit/bookorbit) | Books | OPDS | ✅ Implemented |
| [Grimmory](https://github.com/grimmory-tools/grimmory) | Books | OPDS | ✅ Implemented |
| [Audiobookshelf](https://www.audiobookshelf.org/) | Audiobooks | Audiobookshelf API | ✅ Implemented |
| [RomM](https://github.com/rommapp/romm) | Games | RomM API | ✅ Implemented |
| Kavita, Komga, Calibre-Web, Jellyfin/Emby, Immich, ... | Various | — | Under consideration |

BookLore, BookOrbit, and Grimmory are separate apps (forks of a common lineage) that all expose the same [OPDS](https://opds.io/) catalog protocol, so LatestArr talks to all three through one shared adapter rather than three separate integrations.

New sources are added via a self-contained adapter interface — see [`CONTRIBUTING.md`](CONTRIBUTING.md) if you'd like to add support for something not listed here.

## Getting started

The backend and admin WebUI both run from a single container.

```bash
cp .env.example .env
# Generate a value for ENCRYPTION_KEY in .env: openssl rand -base64 32
docker compose pull   # fetch the published image — skip this to build from source instead
docker compose up -d
```

Then visit `http://localhost:3000`, create the admin account, and the dashboard's setup checklist walks you through connecting a source, adding recipients, configuring SMTP, and creating your first newsletter — no separate wizard, just the admin screens themselves in a sensible order.

See [`.env.example`](.env.example) for every supported environment variable, [`docs/self-hosting.md`](docs/self-hosting.md) for the full walkthrough (reverse proxy setup, OIDC/SSO, backups, upgrades), and [`docs/deliverability.md`](docs/deliverability.md) for why digest emails land in spam without SPF/DKIM/DMARC and how to set them up.

This project is still pre-1.0 — see [`CHANGELOG.md`](CHANGELOG.md) for release notes and the [Issues](https://github.com/jshields-ca/latestarr/issues) page for what's planned or in progress.

## Contributing

Contributions are welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md) for how to set up a dev environment, coding standards, and how to add a new source adapter. Please also read our [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

Found a bug or want a feature? [Open an issue](https://github.com/jshields-ca/latestarr/issues/new/choose). Found a security issue? Please follow the process in [`SECURITY.md`](SECURITY.md) rather than opening a public issue.

If you'd like to support development directly, [GitHub Sponsors](https://github.com/sponsors/jshields-ca) is open. If you just find this useful, a star on the repo goes a long way too.

## Built with Claude Code

LatestArr's code — application logic, tests, CI/release automation, and this documentation — is written by [Claude Code](https://claude.com/claude-code) (Anthropic's AI coding agent), directed by a single human maintainer acting as product owner and reviewer. This is disclosed here because it's directly relevant to how much scrutiny to apply before self-hosting a tool that handles credentials and can be exposed to the public internet.

What that means in practice:

- **Every change is validated before merge**: the full lint/typecheck/build/test suite (`pnpm turbo run lint typecheck build test`) must pass, including automated accessibility checks (axe-core) and a Docker build + runtime smoke test — all enforced in CI (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).
- **UI changes are manually verified in a real browser**, not just against unit tests, before being considered done.
- **Dependency and static-analysis scanning run continuously**: Dependabot for dependency updates, CodeQL for static security analysis.
- **Security-sensitive design decisions are deliberate, not improvised**: envelope-encrypted credentials at rest, server-side sessions rather than client-stored tokens, rate limiting, CSRF protection, and input validation on every route — see [`SECURITY.md`](SECURITY.md) for the full scope and how to report a vulnerability.
- **A human reviews and directs every change** — nothing merges without the maintainer reviewing the actual diff, not just a description of it.

None of this makes LatestArr immune to bugs, and the project is still pre-1.0 (see the callout at the top of this README). Treat AI authorship as a reason to read the code before trusting it with sensitive data — not as a reason to trust this project less than any other early-stage open-source tool.

## License

LatestArr is licensed under the [GNU General Public License v3.0](LICENSE). This is a copyleft license: if you distribute a modified version of LatestArr (including as a fork or a hosted service that distributes the code), your version must also be licensed under GPLv3 and its source made available. Third-party dependencies under permissive licenses (e.g. MIT) are used as libraries and do not change this obligation for LatestArr's own code.

The Sources page's service logos (Tautulli, Plex, BookLore, BookOrbit, Grimmory, Audiobookshelf, RomM) are bundled from [selfh.st/icons](https://selfh.st/icons) under [CC BY 4.0](https://github.com/selfhst/icons/blob/main/LICENSE) — see [`apps/web/src/assets/logos/NOTICE.md`](apps/web/src/assets/logos/NOTICE.md) for per-file attribution. Each logo is also a trademark of its respective project, used here only to identify that source, not to imply endorsement.

---

Built by [Jeremy Shields](https://www.scootr.ca) — see more projects at [scootr.ca](https://www.scootr.ca/projects).
