# @latestarr/db

## 0.12.0

### Minor Changes

- [#277](https://github.com/jshields-ca/LatestArr/pull/277) [`31615b2`](https://github.com/jshields-ca/LatestArr/commit/31615b2d20e5c5fc3c1e0a1dd315ca2ba8bade4b) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** Automatic backups. LatestArr now backs up its database every day at 03:00 and keeps the last seven, with no downtime. It also backs up before every upgrade. The new **Backups** page (admins only) changes the schedule and what's kept, and can **Back up now**, download, or delete a backup. Point `BACKUP_PATH` at another disk or a NAS so a failed disk can't take both the database and its backups. To restore one, run `docker exec -it latestarr node dist/cli.js restore <file>` and restart.

  <details>
  <summary>Technical details</summary>
  - Closes [#263](https://github.com/jshields-ca/LatestArr/issues/263).
  - **Snapshots** use SQLite's online backup API (`better-sqlite3`'s `backup()`), never a raw file copy.
    - Each snapshot is switched out of WAL mode and must pass `PRAGMA integrity_check` before it's kept.
    - It's packed into one ZIP with `manifest.json` (version, migration count, item counts, and an `ENCRYPTION_KEY` fingerprint, never the key) and a README.
    - The file is written under a temporary name and renamed, so a crash never leaves a half-written backup.
    - The ZIP writer and reader are small and in-house (`backups/zip.ts`), using Node's `zlib` deflate and `crc32`, so there's no new dependency.
  - **Names:** `latestarr-backup-<UTC time>-v<version>-<scheduled|manual|pre-upgrade>.zip`. The folder itself is the list of backups, so it stays right after a restore or a manual copy. Download and delete only accept names matching this pattern, so no other path can be reached.
  - **Retention:** keep the newest _N_ (default 7), or calendar rules (the newest of each of the last _D_ days, _W_ weeks, and _M_ months).
    - The newest backup is always kept, and so are the 3 newest pre-upgrade backups.
    - Pruning only runs after a backup succeeds.
  - **Schedule:** on by default, daily at 03:00 in the server's time zone (`TZ`), with the same schedule picker as newsletters.
  - **Pre-upgrade backup:** taken at startup, before migrations, whenever the version that last ran the database (now saved as `appVersion`) differs from this one. Databases from before 0.12 are labelled "earlier".
  - **Failures** are logged, shown on the Backups page, and sent as a failure alert (new **A backup fails** option, on by default, at most one an hour).
  - **Restore** uses the recovery CLI:
    - `check-backup <file>` reports the version, contents, integrity, and whether the key matches.
    - `restore <file>` stages a checked database (`restore-pending.db`), and the next start swaps it in, keeping the old one as `latestarr.db.before-restore-<time>`. `restore --cancel` undoes the staging.
    - It refuses a backup made with another key (unless `--ignore-key-mismatch`) or by a newer version.
    - At startup, LatestArr warns if `ENCRYPTION_KEY` can't decrypt the saved credentials.
  - **Routes:** `GET`/`POST /backups`, `PUT /backups/settings`, `GET /backups/:filename/download`, `DELETE /backups/:filename`, all admin only.
    - Downloads are `no-store` and logged at warn level.
    - The page warns when backups share the database's disk (same device id).
  - `docker/entrypoint.sh` gives the `node` user a separate `BACKUP_PATH` mount. Backup files are written `0600`.
  - Docs: a new "Backups" section with "Restoring a backup" in `docs/self-hosting.md`, plus `BACKUP_PATH` in `.env.example`.

  </details>

- [#276](https://github.com/jshields-ca/LatestArr/pull/276) [`e071447`](https://github.com/jshields-ca/LatestArr/commit/e0714475552f1f690bcaf8b267b4b7ae0a0a1c11) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** A way back in when you forget your password. Choose a **System email** profile on the SMTP Profiles page, and the sign-in page gets a **Forgot password?** link that emails you a one-time reset link. Without email, there's a recovery command for whoever runs the server: `docker exec -it latestarr node dist/cli.js reset-password --email you@example.com` asks you for a new password. Another admin can still reset your password from the Users page.

  <details>
  <summary>Technical details</summary>
  - Closes [#264](https://github.com/jshields-ca/LatestArr/issues/264).
  - **Reset links:** `POST /auth/password-reset/request` and `/confirm`.
    - Tokens are 32 random bytes, stored as SHA-256 hashes in the new `password_reset_tokens` table. They work once, for 30 minutes.
    - A new link cancels older ones, and an account gets at most one email every 2 minutes. Requests are rate limited (5 per 15 minutes per IP).
    - The answer is the same whether or not the account exists, and the email is sent after replying, so timing doesn't reveal it either. SSO-only and deactivated accounts never get a link.
    - Using a link sets the password, signs the account out everywhere, and cancels other links. So does any other password change.
  - **Links are built from `WEB_ORIGIN`, never the request's Host header.** When the address in use doesn't match `WEB_ORIGIN` (say, a proxy in front of an install still set to localhost), email resets stay off rather than sending a broken link, and the SMTP Profiles page explains why.
  - The token travels in the URL fragment (`/reset-password#token=…`), which browsers never send to a server, so it can't reach access logs. The page removes it from the address bar.
  - **System email:** `GET`/`PUT /settings/system-mail` (admin only), stored in `settings`. Deleting the chosen profile turns it off. `/auth/providers` now says whether resets are available.
  - **Recovery command** (`dist/cli.js`):
    - `reset-password --email` asks for the new password twice at a hidden prompt (or reads one line with `--password-stdin`), signs the account out everywhere, and reactivates it if needed. The password is never printed, passed as an argument, or read from the environment.
    - `list-admins` lists the admins.
    - When run as root (the default for `docker exec`), it switches to the data folder's owner first, so SQLite never leaves root-owned files the server can't write.
    - Its actions are written to a new `audit_events` table, which the Logs page merges in.
  - CI's Docker smoke test now runs both commands as root, signs in with a password piped to `--password-stdin`, checks it refuses without a terminal, and checks no root-owned files are left in `/app/data`.
  - Docs: a "Locked out?" section in `docs/self-hosting.md`, and `WEB_ORIGIN`'s role in reset links.

  </details>

## 0.11.2

No changes in this release.

## 0.11.1

No changes in this release.

## 0.11.0

### Minor Changes

- [#206](https://github.com/jshields-ca/LatestArr/pull/206) [`586a3b6`](https://github.com/jshields-ca/LatestArr/commit/586a3b686d504b0db46d5c34e6fecaa4d50a25b4) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** Design how your newsletters look without drag-and-drop. The new **Designs** page (it replaces Templates) lets you pick colours, font, and layout (cards, compact list, or grid); choose which details each item shows; group items by type in your own order; decide what an empty section shows; add a "Most watched" section; and add custom CSS. A live preview updates as you change things, with sample content or any of your real newsletters. Existing newsletters look exactly as before: they use the Default design, which you can duplicate as a starting point.

  **Fixed:** Buttons no longer need a separate "Save buttons" click. They now live in the design and save with everything else.

  <details>
  <summary>Technical details</summary>

  Part of [#199](https://github.com/jshields-ca/LatestArr/issues/199) (phases 1 and 2; phase 1's renderer shipped in [#205](https://github.com/jshields-ca/LatestArr/issues/205)) and closes [#197](https://github.com/jshields-ca/LatestArr/issues/197).

  - Web: `pages/designs-page.tsx` (list, with the built-in Default shown first; create from Default, duplicate, delete) and `pages/design-editor-page.tsx` (settings in collapsible sections, with a sticky preview that re-renders 400 ms after the last change through `POST /templates/preview`, ignoring stale responses; unsaved-changes indicator and leave warning; explicit Save). Nav item and route `/designs`; `/templates` redirects there.
  - Newsletter Content panel: `DesignPicker` replaces the Template picker (Default and your designs, with Edit linking to the design editor), saving with an inline `SaveStatus` instead of a toast. The intro, footer note, buttons, and font moved into the design in [#207](https://github.com/jshields-ca/LatestArr/issues/207).
  - `lib/design.ts` mirrors the server's design settings shape and defaults (`withDesignDefaults` fills options missing from older saved designs).
  - Server: the ungrouped compact and grid layouts line up with the title, like grouped sections; ungrouped cards stays flush so the Default design's recorded output is unchanged.

  </details>

- [#210](https://github.com/jshields-ca/LatestArr/pull/210) [`7159892`](https://github.com/jshields-ca/LatestArr/commit/71598927c31c910b27368e39e554984e95b3aa54) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** The old drag-and-drop template editor is gone, replaced by designs. Templates you built with it become code designs automatically. They send exactly as before, and you can now edit them in the code editor with a live preview. The web app is also much smaller: the drag-and-drop editor alone was a 2.3 MB download.

  <details>
  <summary>Technical details</summary>

  Closes [#199](https://github.com/jshields-ca/LatestArr/issues/199).

  - Removed `grapesjs` and `grapesjs-mjml`, `apps/web/src/lib/grapesjs-*` and `pages/template-editor-page.tsx` (and their tests), and the `cdnjs.cloudflare.com` style and font CSP sources the editor's icon font needed. `/templates/:id/edit` redirects to `/designs/:id`.
  - Migration `0007_retire_drag_and_drop` drops `templates.design_json` (the editor's own project state) and `templates.compiled_html` (never read). A template that was never saved from the editor has no markup and always sent with Default, so it becomes an options design with the default settings.
  - `POST /templates` with only a name now creates an options design. `PATCH` changes `mode` only when it's given explicitly, so saving a code design's text and buttons can't turn it back into an options design.
  - README, self-hosting guide, and CONTRIBUTING describe designs instead of drag-and-drop.

  </details>

- [#203](https://github.com/jshields-ca/LatestArr/pull/203) [`1760569`](https://github.com/jshields-ca/LatestArr/commit/1760569a54163bc88a565e9854e614f113a4f08f) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** A newsletter can skip its scheduled send when there's nothing new, so recipients don't get an empty email. It's on for newsletters you create from now on; existing newsletters keep sending as before until you turn it on under **Delivery**. Skipped sends show in History as "Skipped (nothing new)", and **Send now** always sends.

  <details>
  <summary>Technical details</summary>

  Closes [#194](https://github.com/jshields-ca/LatestArr/issues/194).

  - `newsletters.skip_when_empty` (migration `0005_confused_penance.sql`, default `false` so existing rows are unchanged); `POST /newsletters` sets it to `true` unless given, and `PATCH` accepts it.
  - New `skipped` send-run status (the column is TypeScript-enum text, so no migration). In `run-newsletter.ts`, after rendering, a scheduled or catch-up run with zero newly added items and the option on is marked `skipped` without storing HTML or emailing anyone, and logs `Skipped "…": nothing new in the last N days`. The skipped run keeps its `startedAt`, so missed-send catch-up treats it as handled rather than retrying. A custom template's empty-section fallback content doesn't count as "new". Manual Send now is never skipped.
  - Web: a switch in the Details form's Delivery section, saved with **Save changes**; History and the Dashboard show "Skipped (nothing new)".

  </details>

- [#230](https://github.com/jshields-ca/LatestArr/pull/230) [`cb8fb8e`](https://github.com/jshields-ca/LatestArr/commit/cb8fb8e03b0d4a2e03772b9d193599ca8f7fdb0e) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** More than one person can manage LatestArr. The new **Users** page lets you add people with a temporary password, which they replace with their own the first time they sign in. You can also reset passwords, deactivate or reactivate accounts, and delete users. Everyone has full admin access for now. With SSO set up, add someone with the email their provider uses, and they can sign in with SSO straight away.

  **Fixed:** Deactivating an account now signs it out immediately; before, an open session kept working until it expired. Sign-in email addresses are no longer case-sensitive.

  <details>
  <summary>Technical details</summary>

  Closes [#227](https://github.com/jshields-ca/LatestArr/issues/227).

  - Server: `GET/POST /users` and `PATCH/DELETE /users/:id`, admin-only. Users can't deactivate or delete themselves, and a last-active-admin check is kept as a safeguard. Deleting a user clears `templates.createdBy` and keeps the design. Deactivating or resetting a password ends that user's sessions (`deleteUserSessions`). Changes are logged with who made them.
  - Migration `0008_user_management` adds `users.must_change_password`, set on accounts created or reset by an admin. `PATCH /auth/me` clears it on a password change, refuses reusing the current password, and ends the user's other sessions.
  - `getSessionUser` rejects sessions of deactivated users. Login matches email case-insensitively.
  - OIDC links a new SSO identity to an existing active account with the same email when `email_verified` is true. It still never creates accounts once one exists.
  - Web: a Users page (nav item, `/users`) with add, reset-password, deactivate, and delete; `ProtectedRoute` shows a "Choose a new password" screen while `mustChangePassword` is set. The self-hosting guide gains a Users section and notes on SSO linking.
  - The `role` column already allows editor and viewer. Enforcing those roles is a follow-up.

  </details>

- [#208](https://github.com/jshields-ca/LatestArr/pull/208) [`fae90c9`](https://github.com/jshields-ca/LatestArr/commit/fae90c9d32ce0bd94b337c0f8c8fb21ddb2ed2f0) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** A newsletter's intro, footer note, buttons, and font are now part of its design, set in the design editor where the live preview shows them. The newsletter's settings keep to what goes out, when, and to whom. When you upgrade, each newsletter's existing text, buttons, and font move into a design automatically, so every email looks exactly as before. A newsletter on Default with any of those set gets its own copy of Default, named after it.

  <details>
  <summary>Technical details</summary>

  Closes [#207](https://github.com/jshields-ca/LatestArr/issues/207) (part of [#199](https://github.com/jshields-ca/LatestArr/issues/199)).

  - Design settings gain `content: { intro, footerNote, ctas }` (up to 4 buttons, http(s) links only). The pipeline passes them to every template as `{{introText}}`, `{{footerNote}}`, and `{{#each ctas}}`, so code templates keep working. The Default design no longer takes a per-newsletter font.
  - `render/migrate-content-into-designs.ts` runs once at startup (flagged by the `migration.contentIntoDesigns` settings key). Newsletters sharing a design with different text get a copy each; newsletters with no text keep the original. The old `newsletters` columns stay unused for one release so you can roll back.
  - The newsletter API no longer accepts `emailFont`, `introText`, `footerNote`, or `ctas`. The design editor gets a "Text and buttons" section; Save waits until every button is complete, and half-finished buttons are left out of the preview.

  </details>

## 0.10.0

### Minor Changes

- [#165](https://github.com/jshields-ca/LatestArr/pull/165) [`05eba36`](https://github.com/jshields-ca/LatestArr/commit/05eba36b8e3c431443a7e2b9179b7e366d8592fd) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** The default newsletter template now looks more like LatestArr — bigger, more readable text, warmer Bloom-tinted colors instead of generic gray, a restyled footer with small GitHub/Report-an-issue icons — and each newsletter can now pick which font it sends with (Ubuntu, Arial, Georgia, or Verdana).

  <details>
  <summary>Technical details</summary>

  Addresses production feedback after reviewing a real test send's raw .eml: font sizes felt too small for comfortable/accessible reading, the palette (`#0f172a`/`#64748b`/`#94a3b8`/`[#999999](https://github.com/jshields-ca/LatestArr/issues/999999)`) read as generic rather than Bloom, and the footer was two bare text links.

  - `apps/server/src/render/newsletter-template.ts`: bumped font sizes across the per-item card and header/footer (title 24→28px, item title 16→18px, subtitle 13→14px, overview 13→14px, meta lines 11-12→12-13px), replaced the generic slate palette with the app's own Bloom neutrals (`TEXT_COLOR`/`MUTED_COLOR`/`SUBTLE_COLOR`, derived from `--foreground`/`--muted-foreground`), added a soft tinted fill to the content-kind badge, and rebuilt the footer as a bordered row with small inline-SVG (data: URI) GitHub/report icons next to the existing links — `ACCENT_COLOR` itself was already exactly the app's `--primary`, unchanged.
  - Added a small **Font** picker (`apps/server/src/render/email-fonts.ts`'s `EMAIL_FONTS` catalog: Ubuntu, Arial, Georgia, Verdana — curated web-safe stacks, not arbitrary font upload, which email clients don't support reliably) as a new `newsletters.email_font` column (`packages/db/src/schema.ts`, migration `0003_grey_stardust.sql`, default `"ubuntu"`), validated server-side via a zod enum in `apps/server/src/http/routes/newsletters.ts`, and exposed in the web UI as `EmailFontPicker` next to the existing Template picker in the Newsletters page's Content panel — hidden once a custom template is picked, since a GrapesJS-authored template defines its own fonts.
  - Found along the way: MJML's `<mj-attributes>`/`<mj-all>` defaults aren't honored by the installed `mjml` version for `<mj-text>`'s `font-family` — worked around by setting `font-family` explicitly on every `<mj-text>` tag and in the raw per-item/footer markup instead of relying on template-wide defaults.
  - Scoped to the default template only — the GrapesJS "Media List" block (`apps/web/src/lib/grapesjs-blocks.ts`) that a custom template can use keeps its existing appearance; restyling it was out of scope for this pass.

  </details>

- [#173](https://github.com/jshields-ca/LatestArr/pull/173) [`28ff9e1`](https://github.com/jshields-ca/LatestArr/commit/28ff9e138aeec841c33aecc68539550e9ef77001) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** Newsletters can now include an intro note, a footer note, and up to 4 call-to-action buttons (e.g. a link to your Plex/Jellyfin app, a donation link, "browse the library") in the default template.

  <details>
  <summary>Technical details</summary>

  Addresses the feature request in [#163](https://github.com/jshields-ca/LatestArr/issues/163), folded in alongside the default-template visual refresh ([#162](https://github.com/jshields-ca/LatestArr/issues/162)).

  - Three new `newsletters` columns — `intro_text`, `footer_note` (both nullable text), `ctas` (nullable JSON `{label, url}[]`, migration `0004_busy_ares.sql`) — validated server-side via zod in `apps/server/src/http/routes/newsletters.ts` (`ctas` capped at 4, `url` must be a valid URL, `label` 1-40 chars).
  - `apps/server/src/render/newsletter-template.ts`: intro text renders as a line under the "Here's what's new" intro; CTAs render as a row of `<mj-button>` elements (native MJML, so Outlook VML fallbacks come for free) right below that; the footer note renders as its own line above the existing "Generated by LatestArr" credit. All three are also passed through generically to `renderMjmlTemplate` (`apps/server/src/render/mjml-template.ts`) so a custom GrapesJS-authored template could reference `{{introText}}`/`{{footerNote}}`/`{{#each ctas}}` directly, though only the default template does today.
  - Web UI: two new components on the Newsletters page's Content panel (`apps/web/src/pages/newsletters-page.tsx`) — `NewsletterTextField` (shared by Intro and Footer note, saves on blur only when the value actually changed) and `CtaButtonsField` (a row-editor list with an explicit "Save buttons" button, since a half-typed URL blurring mid-edit shouldn't silently commit). Both hidden once a custom template is picked, same as the existing Font picker.
  - Icon support per CTA (raised in the original request) was intentionally left out of this pass — email-safe icon rendering (inline SVG/data-URI, per the footer icons added in [#162](https://github.com/jshields-ca/LatestArr/issues/162)) adds real scope for a picker UI, and label+URL alone already covers the core use case.

  </details>

- [#148](https://github.com/jshields-ca/LatestArr/pull/148) [`832eebc`](https://github.com/jshields-ca/LatestArr/commit/832eebc286ee6a8116ced59e1ec58a32788f8108) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** Recent Sends history now shows exactly who a send went to and what it included, with a link to the actual rendered copy — not just aggregate counts.

  <details>
  <summary>Technical details</summary>

  `send_runs` gains two columns, set once rendering succeeds (independent of whether individual recipient deliveries later fail): `items_snapshot` (a lightweight `{title, kind}[]` JSON snapshot — the same set `item_count_included` has always counted, now also captured with titles) and `rendered_html` (the actual HTML that was sent, stored verbatim rather than re-rendered on demand, so it reflects exactly what a recipient received even if templates/sources changed since).

  Per-recipient detail already existed in `send_run_recipient_results` (populated by the send pipeline, but never exposed) — new `GET /newsletters/:id/send-runs/:runId/recipients` joins it with `recipients` for each row's email/displayName. New `GET /newsletters/:id/send-runs/:runId/html` serves the stored `rendered_html` directly as `text/html` (a link target, not a JSON-fetched value). The existing list endpoint (`GET /newsletters/:id/send-runs`) explicitly excludes `rendered_html` from each row — it can be tens to hundreds of KB and the list can return many runs at once.

  The newsletter History tab's send-run rows gain a "Details" toggle (only shown when there's something to show) that lazily fetches recipients and renders included-item badges, a per-recipient status list, and a "View a copy of this send" link to the raw HTML endpoint.

  </details>

## 0.9.0

No changes in this release.

## 0.8.0

No changes in this release.

## 0.7.1

### Patch Changes

- e4532fd: Bump better-sqlite3 (11 → 12.11.1) — the DB driver, and the last of the deferred major-version Dependabot pass. Runtime dependency, and a native module, so this carries the same "native module" build risk as before across platforms, not just app-level behavior.

  Landed on 12.11.1 rather than Dependabot's proposed 13.0.3: better-sqlite3 13 dropped Node 20 support entirely (`engines: {"node": ">=22"}`), which would break this repo's Node 20.x CI job — the same class of issue jsdom 30 had (see the earlier `bump-eslint-jsdom` changeset). 12.11.1 is the latest release that still supports Node 20.x through 26.x.

  - `packages/db/src/client.ts`'s usage (`new Database(path)`, `.pragma()`) and `migrate.ts`'s `drizzle-orm/better-sqlite3/migrator` are both stable, long-standing API surface — unaffected by the 11→12 bump.
  - `drizzle-orm`'s own peer range for `better-sqlite3` is `>=7`, so no drizzle-orm compatibility concern either.
  - The native module installs cleanly (`prebuild-install` resolved a prebuilt binary, no compile-from-source fallback needed) on this platform/Node combination.
  - `pnpm turbo run lint typecheck build test` is fully green (40/40 tasks) — `packages/db`'s own tests (WAL mode, foreign keys, migrations) pass, plus every server route test that touches the DB.
  - The actual cross-compile for the Docker image's `node:22-alpine` (musl libc) target isn't something this sandbox can validate directly (no Docker daemon available here) — that's what the PR's own CI "Docker build" job checks for real, same as every other bump in this batch.

- 51311b4: Bump eslint (9 → 10) and @eslint/js (9 → 10) across every package, and jsdom (25 → 29.1.1) in apps/web's test environment. Dev-tooling only, no runtime dependency changes.

  The Dependabot PRs for eslint/@eslint/js (#97, #105) failed CI with a stale, out-of-sync pnpm-lock.yaml on their branch — reproduced locally with a freshly regenerated lockfile and confirmed all 40 lint/typecheck/build/test tasks pass cleanly; `eslint-plugin-jsx-a11y`'s declared peer range hasn't caught up to eslint 10 yet, but it lints without error in practice.

  jsdom's own Dependabot PR (#104) proposed 25 → 30, but jsdom 30 dropped Node 20 support entirely (`engines: "^22.22.2 || ^24.15.0 || >=26.0.0"`), which broke this repo's Node 20.x CI job with `TypeError: webidl.util.markAsUncloneable is not a function` — a real Node-runtime incompatibility, not a lockfile issue. Landing on 29.1.1 instead (the latest jsdom release that still supports Node 20.19+) gets most of the version currency without dropping Node 20 CI support, which is a bigger call than a routine dependency bump.

- 73a6d37: Bump vite (6 → 8, apps/web only), vitest (4 → 5, every package), and @vitejs/plugin-react (4 → 6, apps/web only). Dev-tooling only, no runtime dependency changes.

  Bumped all three together since they're an interlocking build/test toolchain — vitest 5 pins a vite 6+ peer, and @vitejs/plugin-react needs to track the vite major it's paired with. `pnpm turbo run lint typecheck build test` is fully green (40/40 tasks, 189 server tests, 225 web tests); no config changes needed in `apps/web/vite.config.ts` or any `vitest.config`.

## 0.7.0

No changes in this release.

## 0.6.0

No changes in this release.

## 0.5.0

No changes in this release.

## 0.4.6

No changes in this release.

## 0.4.5

No changes in this release.

## 0.4.4

No changes in this release.

## 0.4.3

No changes in this release.

## 0.4.2

No changes in this release.

## 0.4.1

No changes in this release.

## 0.4.0

No changes in this release.

## 0.3.0

No changes in this release.

## 0.2.0

No changes in this release.
