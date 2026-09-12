# LatestArr

**LatestArr** is a self-hosted, open-source "new content" newsletter tool for the self-hosted media ecosystem — the *arr stack and friends. It connects to your existing media servers, pulls in whatever movies, TV episodes, books, audiobooks, and games were recently added, and sends a fully custom-branded HTML digest to your users on a schedule you control.

It exists because [Tautulli](https://tautulli.com/)'s built-in newsletter feature — the closest existing tool to this — only speaks to Plex and offers limited control over layout, scheduling, and branding. LatestArr is a standalone tool, Plex-aware but not Plex-only, built around a drag-and-drop template editor so anyone can design their own newsletter without touching HTML or CSS.

> **Status:** early planning/scaffolding stage. There is no working release yet — see the [Roadmap](#roadmap) below for what's coming and in what order.

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
| Plex (direct) | Movies, TV | Planned (v1) |
| [Tautulli](https://tautulli.com/) | Movies, TV | Planned (v1) |
| [BookLore](https://github.com/booklore-app/booklore) | Books | Planned (v1) |
| [BookOrbit](https://github.com/bookorbit/bookorbit) | Books | Planned (v1) |
| [Grimmory](https://github.com/grimmory-tools/grimmory) | Books | Planned (v1) |
| [Audiobookshelf](https://www.audiobookshelf.org/) | Audiobooks | Planned (v1) |
| [RomM](https://github.com/rommapp/romm) | Games | Planned (v1) |
| Kavita, Komga, Calibre-Web, Jellyfin/Emby, Immich, ... | Various | Under consideration, post-v1 |

New sources are added via a self-contained adapter interface — see [`CONTRIBUTING.md`](CONTRIBUTING.md) if you'd like to add support for something not listed here.

## Roadmap

Development is happening in phases; see the tracked issues/milestones on this repo for current progress.

1. **Repo hygiene & scaffolding** — this phase: docs, CI, monorepo skeleton.
2. **Auth + data model + first adapter** — local/OIDC auth, core schema, Tautulli integration end-to-end.
3. **Scheduler + email delivery MVP** — automated digest sends with a fixed starter template.
4. **Drag-and-drop template builder** — the no-code visual editor and custom content blocks.
5. **Remaining v1 adapters** — direct Plex, BookLore-family, Audiobookshelf, RomM.
6. **Hardening & polish** — security audit, accessibility audit, scale options, 1.0 release.

## Getting started

There's nothing runnable yet. Once the initial scaffold lands, this section will cover:

- Running via Docker/`docker-compose`
- Configuring your first source connection
- Building and scheduling your first newsletter

## Contributing

Contributions are welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md) for how to set up a dev environment, coding standards, and how to add a new source adapter. Please also read our [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

Found a security issue? Please follow the process in [`SECURITY.md`](SECURITY.md) rather than opening a public issue.

## License

LatestArr is licensed under the [GNU General Public License v3.0](LICENSE). This is a copyleft license: if you distribute a modified version of LatestArr (including as a fork or a hosted service that distributes the code), your version must also be licensed under GPLv3 and its source made available. Third-party dependencies under permissive licenses (e.g. MIT) are used as libraries and do not change this obligation for LatestArr's own code.
