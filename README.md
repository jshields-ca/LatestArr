# LatestArr

[![Version](https://img.shields.io/github/package-json/v/jshields-ca/latestarr?label=version)](https://github.com/jshields-ca/latestarr/releases)
[![CI](https://github.com/jshields-ca/latestarr/actions/workflows/ci.yml/badge.svg)](https://github.com/jshields-ca/latestarr/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/license-GPLv3-blue.svg)](LICENSE)

<img src="docs/assets/social-preview.png" alt="LatestArr — self-hosted digest newsletters for Plex, books, audiobooks & games" width="100%" />

**LatestArr** is a self-hosted, open-source "new content" newsletter tool for the self-hosted media ecosystem — the *arr stack and friends. It connects to your existing media servers, pulls in whatever movies, TV episodes, books, audiobooks, and games were recently added, and sends a fully custom-branded HTML digest to your users on a schedule you control.

It exists because [Tautulli](https://tautulli.com/)'s built-in newsletter feature — the closest existing tool to this — only speaks to Plex and offers limited control over layout, scheduling, and branding. LatestArr is a standalone tool, Plex-aware but not Plex-only, built around a drag-and-drop template editor so anyone can design their own newsletter without touching HTML or CSS.

> **Status (v0.2.0, Phase 5 underway):** the backend engine, admin WebUI, and drag-and-drop template builder are all complete and wired end-to-end — connect sources, manage recipients/SMTP/newsletters, design templates visually, and send on schedule, all from the browser. All planned v1 source adapters (Tautulli, direct Plex, BookLore-family, Audiobookshelf, RomM) are implemented. Currently working through security/accessibility hardening and polish ahead of a 1.0 release (see [Roadmap](#roadmap)). See [`CHANGELOG.md`](CHANGELOG.md) for what shipped in each release.

## Why LatestArr?

- **Source-agnostic** — connect Plex/Tautulli, book libraries, audiobook servers, and game libraries, and mix them into one newsletter or split them across many.
- **No-code, drag-and-drop templates** — build your own layout from blocks (movie cards, book cards, headers, footers, ...) with full control over branding, CSS/HTML, and dynamic subject lines, no coding required.
- **Flexible scheduling** — every newsletter has its own schedule, lookback window, sources, and recipient list.
- **Built for public exposure** — OIDC/SSO support, encrypted-at-rest credentials, and secure-by-default hardening, because self-hosted tools increasingly get exposed to the internet.
- **Accessible by default** — the admin UI is built on accessible-first components and tested against automated accessibility checks in CI, not bolted on after the fact.
- **Open source, GPLv3** — built to be forked, extended, and contributed to.

## Supported sources

| Source | Content type | Status |
| --- | --- | --- |
| [Tautulli](https://tautulli.com/) | Movies, TV | ✅ Implemented |
| Plex (direct) | Movies, TV | ✅ Implemented |
| [BookLore](https://github.com/booklore-app/booklore) | Books | ✅ Implemented |
| [BookOrbit](https://github.com/bookorbit/bookorbit) | Books | ✅ Implemented |
| [Grimmory](https://github.com/grimmory-tools/grimmory) | Books | ✅ Implemented |
| [Audiobookshelf](https://www.audiobookshelf.org/) | Audiobooks | ✅ Implemented |
| [RomM](https://github.com/rommapp/romm) | Games | ✅ Implemented |
| Kavita, Komga, Calibre-Web, Jellyfin/Emby, Immich, ... | Various | Under consideration, post-v1 |

New sources are added via a self-contained adapter interface — see [`CONTRIBUTING.md`](CONTRIBUTING.md) if you'd like to add support for something not listed here.

## Roadmap

Development is happening in phases. Versions follow [semver](https://semver.org/) starting at `0.1.0`; see [`CHANGELOG.md`](CHANGELOG.md) for release notes.

1. ✅ **Repo hygiene & scaffolding** — docs, CI, monorepo skeleton. *(v0.1.0)*
2. ✅ **Auth + data model + first adapter** — local/OIDC auth, core schema, Tautulli integration end-to-end. *(v0.1.0)*
3. ✅ **Scheduler + email delivery MVP** — automated digest sends with a fixed starter template. *(v0.1.0)*
4. ✅ **Frontend WebUI + drag-and-drop template builder** — the full admin UI (Tailwind + Radix + Lucide, dark-mode-first, mobile-responsive), the no-code visual editor, and the "Bloom" brand refresh. *(v0.2.0)*
5. ✅ **Remaining v1 adapters** — direct Plex, BookLore-family, Audiobookshelf, RomM. *(v0.2.0)*
6. 🚧 **Hardening & polish** *(current)* — security audit, accessibility audit, scale options, 1.0 release.

### Releasing

Releases are fully automated with [Changesets](https://github.com/changesets/changesets): a merged PR with a pending changeset queues a "Version Packages" PR, and merging that cuts a tagged GitHub Release with consolidated notes — no manual version bumps or tagging. See [`CONTRIBUTING.md`](CONTRIBUTING.md#versioning--releases) for the full mechanics, including how to add a changeset to your own PR.

## Getting started

The backend and admin WebUI both run from a single container — build and run the Dockerfile in `docker/`, and the app is reachable on port 3000, WebUI included. It's not ready for non-technical end users yet: there's no first-run setup guidance beyond the in-app "create the admin account" screen, and the security/accessibility hardening pass (Phase 5) is still underway. A full self-hosting walkthrough (docker-compose, connecting a source, building a template, scheduling a newsletter) will land here ahead of the 1.0 release.

## Contributing

Contributions are welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md) for how to set up a dev environment, coding standards, and how to add a new source adapter. Please also read our [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

Found a security issue? Please follow the process in [`SECURITY.md`](SECURITY.md) rather than opening a public issue.

## License

LatestArr is licensed under the [GNU General Public License v3.0](LICENSE). This is a copyleft license: if you distribute a modified version of LatestArr (including as a fork or a hosted service that distributes the code), your version must also be licensed under GPLv3 and its source made available. Third-party dependencies under permissive licenses (e.g. MIT) are used as libraries and do not change this obligation for LatestArr's own code.
