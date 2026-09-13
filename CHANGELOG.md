# Changelog

All notable changes to LatestArr are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).
While the major version is `0`, breaking changes may still land in minor
releases — see semver's own note on initial development for what `0.x`
means in practice.

Releases are cut with [Changesets](https://github.com/changesets/changesets);
see `CONTRIBUTING.md` for how to add a changeset to a PR.

## [0.1.0] - 2026-09-13

Initial functional milestone: a complete backend engine with no admin UI
yet. An operator can drive the entire loop through the API — connect a
Tautulli server, add recipients, configure SMTP, and build a newsletter —
and it will actually poll for new content and send a digest email on
schedule.

### Added

- Repo scaffolding: pnpm + Turborepo monorepo, CI (lint/typecheck/build/test,
  Docker build, Docker runtime smoke test), Dependabot, OSS contribution
  docs (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`), issue/PR
  templates.
- `packages/db`: full Drizzle/SQLite schema and migrations for the entire
  data model (users, sessions, source connections, recipients/groups,
  templates, newsletters, send runs, settings).
- `packages/crypto`: AES-256-GCM envelope encryption for credentials at
  rest.
- Local username/password auth (argon2id, server-side sessions) and
  generic OIDC/SSO auth (`openid-client`, PKCE authorization-code flow).
- `packages/adapters/core`: the `SourceAdapter` contract and registry every
  future source integration implements.
- `packages/adapters/tautulli`: the reference adapter implementation,
  proven end-to-end via a SourceConnection CRUD API (create, test
  connection, list libraries, fetch recently-added items).
- Recipients and RecipientGroups CRUD, with group membership management.
- SmtpProfile CRUD and a Nodemailer-based mailer (connection test,
  send-test-email).
- Newsletter CRUD, with source and recipient-group associations.
- A hardcoded Handlebars starter template rendering recently-added items
  into email HTML (the drag-and-drop builder replacing this is planned for
  the next release).
- The send pipeline: fetch recently-added items from every linked source,
  render, resolve recipients, send, and record a `SendRun` /
  `SendRunRecipientResult` per attempt — exposed via a manual
  `POST /newsletters/:id/send-now` trigger and a `GET .../send-runs`
  history endpoint.
- A croner-based scheduler running each newsletter on its own cron
  expression and timezone, refreshed live whenever a newsletter is
  created, updated, or deleted.

[0.1.0]: https://github.com/jshields-ca/latestarr/releases/tag/v0.1.0
