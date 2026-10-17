# Changelog

All notable changes to LatestArr are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).
While the major version is `0`, breaking changes may still land in minor
releases — see semver's own note on initial development for what `0.x`
means in practice.

Releases are cut with [Changesets](https://github.com/changesets/changesets);
see `CONTRIBUTING.md` for how to add a changeset to a PR.

## [0.12.5] - 2026-10-17

### Fixed

- Follow-ups to 0.12.4's full reading of sources. ([#373](https://github.com/jshields-ca/LatestArr/pull/373))

  - **No false warning for Audiobookshelf:** the "may have more new items" warning now appears only when a source really stopped at its 1,000-item cap. Several busy Audiobookshelf libraries could trigger it when none reached its own cap. (#370)
  - **Most items per section accepts up to 100:** it was limited to 50, while leaving it blank shows up to 100. (#371)
  - **Code designs stay a sensible length:** a Media List with no count, or set to show everything, now lists at most 100 items, like designs built from options. (#372)

  <details>
  <summary>Technical details</summary>

  - **#370:** `readNewest` takes an `onCapReached` callback, called only when reading stopped at `MAX_RECENT_ITEMS` without reaching older items, a short page or an error, and never for an explicit `limit`. `FetchRecentItemsParams.onCapReached` passes it through every adapter, and `run-newsletter.ts` warns from it instead of comparing the source's total with 1,000.
  - **#371:** the design schema's `sections.limit` and the editor field allow 1–100.
  - **#372:** the `mediaList` helper caps its selection at `MAX_SHOWN_ITEMS` (100), including `showAll="true"` and a missing `count`. `{{#each items}}` in hand-written MJML stays as written.
  - Found by the latestarr.app session while documenting 0.12.4.

  </details>

- Jellyfin and Emby sources wait up to 30 seconds for a response, like every other source. ([#376](https://github.com/jshields-ca/LatestArr/pull/376))

  They gave up after 15 seconds, so a slow or busy server could fail a check or a send that other sources would have finished.

  <details>
  <summary>Technical details</summary>

  - `jellyfin-client.ts` drops its own 15-second `REQUEST_TIMEOUT_MS` for the shared `SOURCE_REQUEST_TIMEOUT_MS`.
  - The 10-second image timeout, defined separately in all six adapter clients, is now `IMAGE_REQUEST_TIMEOUT_MS` in `adapter-core`'s `http-limits.ts`.
  - Tautulli's leftover `DEFAULT_FETCH_COUNT` is renamed `POPULAR_FETCH_COUNT`, since it now only sizes "most watched".
  - The webhook timeout in `alerts.ts` is named `WEBHOOK_TIMEOUT_MS`.

  </details>

## [0.12.4] - 2026-10-17

### Fixed

- Newsletters no longer miss new items on a busy week. ([#366](https://github.com/jshields-ca/LatestArr/pull/366))

  - **Everything in the lookback window:** LatestArr read only the 100 newest items from each source, shared by all of its libraries. So on a Plex server, a big week of TV could push that week's movies out of the newsletter entirely. It now reads everything added in the newsletter's lookback window, page by page.
  - **A safety cap:** at most 1,000 items per source (per library for Audiobookshelf) on each check. Reaching it is logged as a warning on the Logs page.
  - **Emails stay a sensible length:** a section with no **Most items per section** limit shows up to 100 items, about the most it could before.

  <details>
  <summary>Technical details</summary>

  - **`adapter-core`:** `readNewest` pages newest-first (`RECENT_PAGE_SIZE` 100) until a page reaches items older than `since`, comes back short, adds nothing new (a source that ignores paging), or the total reaches `MAX_RECENT_ITEMS` (1,000). A first-page error is thrown as before; a later page's error keeps what was read.
  - **Adapters:**
    - Plex: `X-Plex-Container-Start`;
    - Tautulli: `start`;
    - Jellyfin and Emby: `StartIndex`;
    - Audiobookshelf: `page`, from 0;
    - RomM: `offset`;
    - BookLore, BookOrbit and Grimmory: OPDS `page`, from 1, since both BookOrbit and BookLore cap `size` at 100.

    An explicit `limit` still reads that many.
  - **Server:** `run-newsletter.ts` warns when a source returns `MAX_RECENT_ITEMS`. `design.ts` renders sections with `count="${limit ?? MAX_SHOWN_ITEMS}"` (100), and the design editor's placeholder reads "Up to 100". Designs written in code (`{{#each items}}`) aren't capped.
  - Found while documenting the limit for #362; the "+ N more" line follows in 0.13.0.

  </details>

## [0.12.3] - 2026-10-17

### Improved

- Buttons and TV links in newsletters fit what they point to. ([#360](https://github.com/jshields-ca/LatestArr/pull/360))

  - **Listen on BookOrbit:** under Audiobooks, a source's button now says **Listen on**, under Books **Read on**, under Movies and TV **Watch on**, and under Games **Play on**. Before, one source had one label everywhere, so BookOrbit's audiobooks had a **Read on BookOrbit** button.
  - **TV rows link to the season or show:** a row that groups several new episodes now links to their season, or to the show when they're from different seasons, as Tautulli's newsletter does. Each episode listed under it still links to that episode. This works for Plex and Tautulli sources.

### Fixed

- BookOrbit books and audiobooks now show their synopsis, like movies do. ([#360](https://github.com/jshields-ca/LatestArr/pull/360))

  <details>
  <summary>Technical details</summary>

  - **Synopsis:** BookOrbit puts an entry's description in `<content type="text">`; BookLore and Grimmory use `<summary>`. `getEntrySummaryText` now falls back to `<content>`, and ignores an empty one.
  - **Verbs:** `buildSourceButtons` adds `labelsByKind`, with the verb chosen by kind (`VERB_BY_KIND`), and the `sourceButtonsFor` helper uses the label for its section's kind. Buttons not under a section keep the app's own verb.
  - **TV links:** `NewItem` gains `seasonUrl` and `seriesUrl`. Plex fills them from `parentRatingKey` and `grandparentRatingKey`, and Tautulli from `parent_rating_key` and `grandparent_rating_key`, as Plex Web deep links. `groupEpisodes` links the row to the shared season, else the series, else the first episode.
  - Reported in #353 and #359.

  </details>

- Plex links through `https://app.plex.tv` now open the item, even when Plex first asks people to sign in or choose a profile. ([#364](https://github.com/jshields-ca/LatestArr/pull/364))

  They opened the Plex home page instead. Links now use the same form as Tautulli's newsletter links, `https://app.plex.tv/desktop#!/…`, which a user confirmed in #353 keeps the item through Plex's profile picker. Links to a self-hosted Plex address are unchanged.

  <details>
  <summary>Technical details</summary>

  `plexWebAppUrl` returns `https://app.plex.tv/desktop` (no trailing slash) for app.plex.tv. In #353, `/desktop#!/…` reached the item after the profile picker, while `/desktop/#!/…` (0.12.2) and `/web/index.html#!/…` (0.12.1) both ended on the home page. Item, season and series links and the fallback link all use it.

  </details>

## [0.12.2] - 2026-10-16

### Improved

- When a backup can't be written, the error links to the fix on latestarr.app. ([#352](https://github.com/jshields-ca/LatestArr/pull/352))

  The message, on the Backups page, in the log and in the failure alert, now ends with a link to the Backups guide's **Can't write** section, which walks through checking and fixing the folder's permissions.

  <details>
  <summary>Technical details</summary>

  `explainFolderError` in `backups/service.ts` appends `https://www.latestarr.app/docs/backups#cant-write`. The site keeps that anchor stable.

  </details>

### Fixed

- Book and Plex links in newsletters open the right item, BookOrbit audiobooks show as audiobooks, and the OPDS sign-in hint is corrected. ([#355](https://github.com/jshields-ca/LatestArr/pull/355))

  - **BookOrbit, BookLore and Grimmory links:** a book now links to its own page, at your Public URL. Before, every book linked to the library's front page, because these apps' feeds don't include a link to each book.
  - **BookOrbit audiobooks:** an item whose files are all audio now shows as an **Audiobook**, under Audiobooks, instead of as a book. A book with both an ebook and its audio stays a book, labelled **Ebook + audio**. MOBI, AZW3 and FB2 books now show as **Ebook**, and CB7 comics as **Comic**, instead of just "Book".
  - **Plex links on app.plex.tv:** with `https://app.plex.tv` as the Public URL, links now use Plex's own `/desktop/` address. The old link reached `/desktop/` through a redirect, and the item could be lost on the way, especially when Plex asked people to sign in first, leaving them on the Plex home page.
  - **OPDS hint:** BookLore, BookOrbit and Grimmory use separate OPDS accounts, not your normal sign-in. The hint now says so, and where to create one. It used to say to use your normal sign-in.

  <details>
  <summary>Technical details</summary>

  - **`booklore-client.ts`:** `getEntryBookId` reads `urn:booklore:book:<id>` and `urn:bookorbit:book:<id>`, and `isAudiobookEntry` is true when every acquisition link has an `audio/*` type. `getEntryFormatLabel` recognises the MIME types BookOrbit serves for MOBI, AZW and AZW3, FB2 and CB7, and adds " + audio" when an item also has audio files. BookOrbit serves `.m4b` as `audio/mp4` and `.mp3` as `audio/mpeg`.
  - **`booklore-adapter.ts`:** links are chosen in this order: `rel="alternate"`, then `/book/<id>` (the route in all three apps), then `rel="self"`, then the library root. `supportsMediaKinds` is now `["book", "audiobook"]`, and `mediaKinds` filters each item. The app always saves an empty filter, so existing newsletters keep their audiobooks.
  - **`adapter-core`:** a new `plexWebAppUrl` returns `https://app.plex.tv/desktop/` for app.plex.tv, and `<url>/web/index.html` otherwise. `buildPlexWebDeepLink` and the Plex and Tautulli fallback links use it.
  - Reported in #353.

  </details>

- For a Tautulli source, the **Public URL** hint now says to use your Plex server's address, and that without one, items have no links. ([#350](https://github.com/jshields-ca/LatestArr/pull/350))

  It said item links fall back to the Base URL, which is true for every other source but not Tautulli: Tautulli's address isn't a page recipients can use, so LatestArr makes no links from it.

  <details>
  <summary>Technical details</summary>

  `PublicUrlHint` in `pages/sources-page.tsx` takes the source kind, matching `buildExternalUrl` in `tautulli-adapter.ts`, which returns no link without `publicUrl` and builds a Plex Web link from it.

  </details>

## [0.12.1] - 2026-10-15

### Improved

- The Backups page's help links open the Backups guide on latestarr.app. ([#348](https://github.com/jshields-ca/LatestArr/pull/348))

  **Restoring a backup** and the note about where backups are saved now link to the friendly guide instead of the repository's technical reference.

  <details>
  <summary>Technical details</summary>

  `RESTORE_DOCS_URL` and `BACKUP_PATH_DOCS_URL` in `pages/backups-page.tsx` point to `latestarr.app/docs/backups#restoring-a-backup` and `#where-theyre-saved`. The `README.txt` inside each backup still links to `docs/self-hosting.md#restoring-a-backup`, which ships with the code.

  </details>

- Clearer **Base URL** and **Public URL** fields when adding or editing a source. ([#343](https://github.com/jshields-ca/LatestArr/pull/343))

  Each field now has its own short explanation. The **Base URL** is where LatestArr connects, so a local address is fine. The **Public URL** is where recipients go when they click. Before, one hint under Public URL tried to explain both, and called the Base URL "the address above".

  <details>
  <summary>Technical details</summary>

  `BaseUrlHint` and `PublicUrlHint` in `pages/sources-page.tsx`, shared by the Add and Edit source dialogs, each linked to its input with `aria-describedby`.

  </details>

### Fixed

- A backup that can't be written now says which folder is the problem. ([#341](https://github.com/jshields-ca/LatestArr/pull/341))

  Before, a backup folder LatestArr couldn't write to failed with SQLite's "unable to open database file", on the Backups page, in the log, and in the failure alert. It now names the folder and says to check that LatestArr can write to it.

  <details>
  <summary>Technical details</summary>

  `makeBackup` maps `SQLITE_CANTOPEN` and file-system errors (`EACCES`, `EPERM`, `EROFS`, `ENOENT`, `ENOTDIR`, `EEXIST`) to a message naming `backupDir`, keeping the original error as `cause`.

  </details>

- The Notifications page's cards now span the page like every other page's. ([#342](https://github.com/jshields-ca/LatestArr/pull/342))

  They were narrower than the rest on a desktop. The fields inside them keep a comfortable width, as on the Backups page.

  <details>
  <summary>Technical details</summary>

  The `max-w-2xl` cap moves from the form to each card's `CardContent`.

  </details>

- Each person's result in a send's details reads as a word (**Sent**, **Failed**, **Bounced** or **Unsubscribed**), like the send's own status, instead of `sent` or `failed`. ([#339](https://github.com/jshields-ca/LatestArr/pull/339))

  <details>
  <summary>Technical details</summary>

  - **`components/send-run-history.tsx`:** a `RECIPIENT_STATUS_LABEL` map for `SendRunRecipientResult["status"]`, alongside the run labels in `lib/send-run.ts` from #336.

  </details>

## [0.12.0] - 2026-10-13

### New

- The container image now runs natively on ARM: Apple Silicon Macs, Raspberry Pi 4 and 5 (on a 64-bit OS), ARM NAS boxes and cloud servers. Docker picks the right image for you, so `docker compose pull` just works, with no `--platform linux/amd64` emulation. ([#323](https://github.com/jshields-ca/LatestArr/pull/323))

  <details>
  <summary>Technical details</summary>

  - Closes #318.
  - **`publish-image.yml`** is a new reusable workflow used by `dev-image.yml` and `release.yml`.
    - It builds `linux/amd64` on `ubuntu-latest` and `linux/arm64` natively on `ubuntu-24.04-arm`, rather than under QEMU. Each pushes by digest.
    - A merge job then publishes one multi-platform manifest per tag, and checks that both architectures are there.
  - **CI:** builds and smoke-tests the arm64 image too ("Docker build (arm64)"). The native modules (better-sqlite3, sharp, @node-rs/argon2) load at startup, so a missing arm64 binary fails the health check. The required "Docker build" check keeps its name.
  - **Out of scope:** 32-bit ARM (`linux/arm/v7`), because sharp ships no prebuilt binaries for it.

  </details>

- Automatic backups. LatestArr now backs up its database every day at 03:00 and keeps the last seven, with no downtime. It also backs up before every upgrade. The new **Backups** page (admins only) changes the schedule and what's kept, and can **Back up now**, download, or delete a backup. Point `BACKUP_PATH` at another disk or a NAS so a failed disk can't take both the database and its backups. To restore one, run `docker exec -it latestarr node dist/cli.js restore <file>` and restart. ([#277](https://github.com/jshields-ca/LatestArr/pull/277))

  <details>
  <summary>Technical details</summary>

  - Closes #263.
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

- More colour and button options for designs, under **Colours and font** and **Buttons** in the design editor. ([#312](https://github.com/jshields-ca/LatestArr/pull/312))

  - **More colours:** choose your own colours for type labels (text and background) and for links in the intro and footer note, and under **Buttons**, the button colour and button text. Each follows the accent until you set it, and the × puts it back, so existing designs, Default included, look exactly as before. Custom label and link colours get dark-mode versions too.
  - **Button style:** rounded, square or pill shape, regular or small, for every button. Your own buttons and "Where to watch" buttons can each be filled or outlined.
  - **Contrast check:** the editor warns when a colour pair would be hard to read (below WCAG AA, 4.5:1). It doesn't stop you saving.

  <details>
  <summary>Technical details</summary>

  - Closes #293.
  - **Settings:**
    - `colors` gains `labelText`, `labelBackground`, `buttonBackground`, `buttonText` and `link`, as nullable hex values defaulting to `null`, which means they follow the accent.
    - New `buttons: { shape, style, size }`, defaulting to `rounded`, `filled` and `regular`.
  - **`paletteFor`** works out the label, button and link colours, matching today's output when they're unset. The default-design snapshot is unchanged.
  - **`darkPaletteFor` and `darkModeHead`** add dark rules only for custom colours that differ from those already covered. Buttons keep their colours in dark mode, as before.
  - **`button()`** takes the button settings:
    - shape sets `border-radius` to 0, 8 or 999 px;
    - size sets the padding and font size, with outlined buttons losing 1 px of padding to their border;
    - an outlined primary button uses the background and button colour.
    - `mj-button` keeps all of this working in Outlook.
  - **Notes' links** use `colors.link`, falling back to the accent.
  - **Web:** `lib/colour.ts` has `mix`, `contrastRatio`, `effectiveColour` and `contrastWarnings`. The editor gains `AdvancedColours`, `ButtonStyle` and `ContrastNotes`.

  </details>

- Add your logo to the top of a design, under **Logo** in the design editor. ([#315](https://github.com/jshields-ca/LatestArr/pull/315))

  - **Upload** a PNG, JPEG or GIF (up to 1 MB). It's included in each email, so it shows even where email apps block images from the web. Or use an **image URL**, either copied into each email (the default) or linked.
  - **Link it** to your server's site, Overseerr, or your Plex or Jellyfin app.
  - Put it **above the newsletter's name or in place of it**, aligned left, centre or right, at the width you choose. It shrinks to fit on phones.
  - Add a **dark mode version** for logos with dark lettering, which would otherwise disappear on dark backgrounds. Switch the preview to Dark to check it.
  - Code designs can place it themselves with `{{logo}}`.

  <details>
  <summary>Technical details</summary>

  - Closes #302.
  - **Storage:**
    - New `design_images` table (migration `0011_design_images`) for uploads, referenced by id from a design's `settings.logo`. Backups include it, since they copy the whole database.
    - Uploads no design uses are removed after 24 hours (`pruneUnusedDesignImages`, run on upload and when a design is saved or deleted).
  - **Uploads:** `POST /api/templates/images` (editors and admins) and `GET /api/templates/images/:id` (signed in, cached as immutable).
    - `cleanImage` checks the contents, not the file name, and accepts PNG, JPEG and GIF only. SVG is refused with its own message.
    - It re-encodes the image, which drops metadata, turns photos the right way up, and scales anything over 1100 px wide down.
  - **Settings:** `logo: { source, imageId, darkImageId, url, darkUrl, urlMode, link, placement, align, maxWidth, alt }`. URLs are http(s) only and `maxWidth` runs from 40 to 550 px. Without a logo, the default design's output is unchanged (snapshot test).
  - **Rendering:**
    - `resolveLogo` embeds uploads as `cid:` attachments.
    - When sending, it fetches image URLs with the same timeout and size cap as posters and an image content type only. If that fails, the email links to the URL instead and the send carries on.
    - Previews never fetch URLs (anyone signed in can preview), so the server never requests an address on a viewer's behalf.
    - The logo's attachments are kept with the send, so "Send to the rest" includes it.
  - **Dark mode:** the dark image is hidden and kept from Outlook with a conditional comment. It's swapped in by `prefers-color-scheme` and `[data-ogsc]` rules, which are added only when a dark image is set. A dark design always shows its dark image.
  - **Web:** `DesignLogoFields` in `components/design-logo-fields.tsx`. An incomplete logo holds back Save and is left out of the preview.

  </details>

- A design's **Intro** and **Footer note** support simple formatting and alignment. ([#311](https://github.com/jshields-ca/LatestArr/pull/311))

  - **Formatting:** **bold**, *italic*, ~~strikethrough~~, `[links](https://example.com)` (in the design's accent colour), and bulleted or numbered lists.
  - **Alignment:** each note can be left, centre or right aligned.
  - **What stays the same:** existing notes look as they did, and HTML typed into a note still shows as text. One thing to check: a `*` or `_` around words, or a line starting with `-` or `1.`, now formats.

  <details>
  <summary>Technical details</summary>

  - Closes #290.
  - New `render/notes.ts`, using [markdown-it](https://github.com/markdown-it/markdown-it) 15 (a new server dependency) from its `zero` preset.
    - Enabled: lists, newline (`breaks: true`), emphasis, strikethrough, link, escape, entity. `html: false`.
    - `validateLink` allows only `http`, `https` and `mailto`.
    - Paragraphs, lists and links get inline styles, since email clients ignore most stylesheets. Lists are `inline-block` so they follow the note's alignment.
    - A single paragraph renders unwrapped, so the existing snapshot is unchanged. The last block's bottom gap is dropped.
  - `{{introText}}` and `{{footerNote}}` now render this Markdown in code-mode designs too, replacing #289's line-break helper. Links use `noteLinkColor`, the design's accent, which `designContentVariables` passes along.
  - New settings `content.introAlign` and `content.footerAlign` (`left`, `center` or `right`; default `left`) become `mj-text align`.
  - Editor: a `NoteField` with an alignment picker in design mode and a formatting hint.

  </details>

- A way back in when you forget your password. Choose a **System email** profile on the SMTP Profiles page, and the sign-in page gets a **Forgot password?** link that emails you a one-time reset link. Without email, there's a recovery command for whoever runs the server: `docker exec -it latestarr node dist/cli.js reset-password --email you@example.com` asks you for a new password. Another admin can still reset your password from the Users page. ([#276](https://github.com/jshields-ca/LatestArr/pull/276))

  <details>
  <summary>Technical details</summary>

  - Closes #264.
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

- A **groups** column in a recipient import adds each person to those groups, and creates any that don't exist yet. ([#322](https://github.com/jshields-ca/LatestArr/pull/322))

  - Put several groups in one cell separated by `;`, or by commas in a file separated by semicolons. Groups match by name, ignoring case and spaces.
  - The review lists each group: new or existing, and how many people the import adds to it. Nothing changes until you choose **Import**.
  - An import only adds people to groups. It never removes anyone.
  - The template file now includes a groups column.

  <details>
  <summary>Technical details</summary>

  - Part 2 of #288.
  - **Server:**
    - Import rows take `groups: string[]` (up to 20 names of up to 100 characters each).
    - The plan gains `groups: [{ name, isNew, adding }]`, where existing group names keep their own spelling.
    - Applying, in the same transaction, creates the missing groups and inserts memberships with `onConflictDoNothing`. It returns `createdGroups` and `membershipsAdded`.
    - An existing recipient who only joins groups no longer counts as unchanged.
  - **Web:**
    - The parser reads a Group or Groups column, and in heading mode splits cells on the file's own delimiter.
    - The review has a Groups section.
    - New groups and memberships show on the page straight away (`GroupSyncContext`).

  </details>

- Import recipients from an Excel file, and undo the last import. ([#325](https://github.com/jshields-ca/LatestArr/pull/325))

  - **Excel:** upload an `.xlsx` file. Its first sheet is read like a CSV, with the same review before anything changes. Older `.xls` files get a message asking you to save as `.xlsx` or CSV.
  - **Undo last import** appears next to **Import** for 24 hours, or until your next import. It removes the people and groups the import added, takes people back out of the groups it added them to, and puts back the names it changed. Anything changed since is kept, and Undo tells you what. A person is also kept if they've been sent a newsletter since, so their history stays.

  <details>
  <summary>Technical details</summary>

  - Part 3 of #288, which completes it.
  - **Excel:**
    - Read in the browser with [read-excel-file](https://www.npmjs.com/package/read-excel-file) 9.3.10 (MIT), loaded only when a spreadsheet is chosen. The server never parses a spreadsheet.
    - read-excel-file doesn't run formulas. It reads the values the spreadsheet app saved.
    - Limits: 5 MB and 1000 rows.
    - The first sheet becomes tab-separated text in the import box (`lib/spreadsheet.ts`), so it goes through the same parser and review as a paste or CSV.
    - Works under the app's CSP (checked in a browser).
  - **Undo:**
    - New `recipient_imports` table (migration `0012_recipient_imports`), holding the latest import's changes: recipients created, names changed, memberships added, groups created.
    - `GET /api/recipients/imports/latest` and `POST /api/recipients/imports/:id/undo` are editor-only.
    - `undoRecipientImport` runs in one transaction and returns what it undid, plus what it kept and why: edited or deactivated people, people sent a newsletter since, names changed again, and groups that were renamed, described, used by a newsletter or given other members.
    - Logged on the server.

  </details>

- **Send to the rest** finishes a newsletter that only reached some of its recipients, without sending anyone a duplicate. Use it when LatestArr stopped partway, the mail server turned some people away, or a rate limit cut a send off. Open the send's **Details** in the newsletter's **History** and choose **Send to the rest**. It sends the same email, with the same items, subject and images, to only the people who didn't get it, including anyone whose delivery failed. A confirmation shows who it will go to, and their results are added to the same send. It works on the newsletter's latest send, within its lookback window, and is for editors and admins. ([#309](https://github.com/jshields-ca/LatestArr/pull/309))

  <details>
  <summary>Technical details</summary>

  - Closes #283.
  - **Migration `0010_send_to_the_rest`:**
    - `send_runs.subject`, set with `rendered_html`;
    - `send_runs.rest_sent_at`;
    - a new `send_run_attachments` table holding a send's embedded images (cid, filename, type, bytes). A newsletter's earlier sends' images are deleted when its next send renders, so storage stays at one send per newsletter.
  - **New `pipeline/send-to-the-rest.ts`:**
    - `planSendToTheRest()` checks that the send is `partial_failure` or `failed` and has its stored subject, HTML and every referenced image.
    - It also checks that it's the newsletter's latest send (no later send, by insertion order, reached anyone) and that it started within `lookbackDays`.
    - It returns the newsletter's active recipients not recorded as `sent`.
    - `sendToTheRest()` claims the run by setting it to `running` in one conditional `UPDATE`, which shares Send now's "already running" lock and stops two requests from both sending. It then sends, replaces each recipient's earlier result, and sets the final status, `finishedAt` and `restSentAt`, in a `finally` block.
    - If LatestArr stops partway, the startup clean-up from #280 closes the send as usual.
  - **API:**
    - `GET /newsletters/:id/send-runs/:runId/rest` (editor) returns the plan, or why the send can't be finished.
    - `POST /newsletters/:id/send-runs/:runId/send-to-rest` (editor) answers 409 when the send can't be finished or another send is running.
    - The History list adds `canSendToRest` and `restSentAt`, and breaks ties on start time by insertion order.
  - **Web:** a `SendToRestDialog` in the send's details, and "Sent to the rest" with its time in History.
  - **Docs:** `self-hosting.md` covers finishing a partly sent newsletter. The interrupted-send message and alert now point to **Send to the rest**.

  </details>

- A quiet **Sponsor** link in the web app's footer, and a line under **Star on GitHub** in the star popover, both linking to GitHub Sponsors. They're plain links: no banners, pop-ups or reminders, and nothing in the newsletters people receive. ([#326](https://github.com/jshields-ca/LatestArr/pull/326))

  <details>
  <summary>Technical details</summary>

  - Closes #266.
  - The footer gains `Sponsor` (heart icon) after Discussions, in the same tertiary style as the other links. The star popover gains a muted secondary link under its button.
  - Both point to https://github.com/sponsors/jshields-ca and open in a new tab. App-shell tests check both.

  </details>

- Link SSO to an existing account from your profile. ([#320](https://github.com/jshields-ca/LatestArr/pull/320))

  - **Sign-in from another address** now works: **Continue with SSO** first moves you to the address in `OIDC_REDIRECT_URI`, where your identity provider sends you back.
  - **Link SSO** in your profile connects your SSO account to the account you're signed in to. It works even when your provider doesn't mark your email address as verified, which stopped automatic matching before. **Unlink SSO** is there too, for accounts that also have a password.
  - **Plain messages:** a failed SSO sign-in now goes back to the sign-in page with a reason, not a page of raw JSON, and the logs say exactly why.

- Subject variables, so each issue's subject can change with each send, such as "The latest from {period}" or "{count} new: {counts}". ([#327](https://github.com/jshields-ca/LatestArr/pull/327))

  - **Variables:** `{newsletter}`, `{date}`, `{shortDate}`, `{period}`, `{month}`, `{year}`, `{count}` and `{counts}`. They're filled in on each send in the newsletter's timezone, so the subject matches the dates in the email.
  - **In the form:** **Insert a variable** adds one at the cursor, and a live line shows the next subject (with example counts). A misspelled variable like `{dat}` is flagged as you type, and saving refuses it, so a typo never reaches an inbox.
  - **Preview and history:** **Preview** shows the real next subject, **Send test** uses it (with `[Test]`), and History records the subject as sent.
  - **Nothing new:** a subject built around `{count}` or `{counts}` becomes "<newsletter>: nothing new" instead of "0 new".
  - **Unchanged:** a blank subject still uses the newsletter's name, and existing subjects work exactly as before.

  <details>
  <summary>Technical details</summary>

  - Closes #267.
  - **`render/subject.ts`:**
    - `renderSubject` uses single-brace placeholders, not Handlebars, so there's no HTML escaping or template errors in a plain-text header. Only known variables are replaced, and other braces stay as typed.
    - The result has control characters and line breaks turned into spaces (no header injection), is trimmed, and is capped at 200 characters.
    - `unknownSubjectVariables` backs the save-time check, which uses a plain-language message.
  - **`render/dates.ts`:** timezone-aware date formatting, now shared by the subject and the email's send date and date range (`generatedAtFormatted`, `periodFormatted`). The email's dates now use the newsletter's timezone instead of the server's. That only differs around midnight, and an invalid timezone falls back to the server's.
  - **Web:** `components/subject-field.tsx` and `lib/subject.ts`, which mirrors the server's variables and formatting for the live preview.

  </details>

- Users can now be admins, editors, or viewers. Viewers see newsletters, designs, previews, and send history without being able to change anything. Editors can also create and send newsletters, edit designs, and manage recipients. Admins can do everything, including sources, SMTP, notifications, users, and logs. Choose a role when you add someone, or change it from the Users page. Existing users stay admins. ([#274](https://github.com/jshields-ca/LatestArr/pull/274))

  <details>
  <summary>Technical details</summary>

  - Closes #257. Roles are enforced on the server: `requireAuth(db, { read, write })` gives each route group the role it needs for `GET` and for changes, and a route can ask for a different one with `config: { minRole }` (previews are open to viewers; `GET /sources/:id/libraries` and `/users`, recipient lists, and a send's recipient results need an editor).
  - A refused request answers `403` with `code: "role_required"` and the role needed, and is logged.
  - `security.test.ts` lists every signed-in route with the role it needs, fails when a new route isn't listed, and checks each route against all three roles.
  - `POST /users` takes a `role` (default `viewer`) and `PATCH /users/:id` can change it. Admins can't change their own role, and the last active admin can't be demoted, deactivated, or deleted. Role changes apply on the next request.
  - The web app hides the pages and controls a role can't use: the sidebar is filtered, admin-only pages show a "No access" card, newsletters and designs are read-only for viewers (a disabled `fieldset`, and a read-only code editor), and pages only fetch what the role can read.
  - The SMTP Profiles page is admin-only; editors still get the profile list for choosing one on a newsletter.

  </details>

### Improved

- A clearer Backups page. ([#336](https://github.com/jshields-ca/LatestArr/pull/336))

  - **Status at a glance:** one card shows the last backup, the next one, where they're saved, and how many there are with their total size. A note in that card warns when they're on the same disk as the database, with a link to how to fix it.
  - **Always in agreement:** the last backup comes from the backups actually in the folder. After changing `BACKUP_PATH`, it no longer names a backup the list doesn't show.
  - **Backups first:** Saved backups comes next, newest first, with Download and Delete in each row.
  - **Settings summed up:** Schedule and retention says what's set in its header, like "Daily at 3:00 AM (UTC), keeps the latest 7.". Its form no longer stretches across the page.
  - **Restoring in three steps:** check, restore, and restart, each with a copy button, already filled in with your newest backup's name. The `ENCRYPTION_KEY` reminder sits with them.

  <details>
  <summary>Technical details</summary>

  - From release testing in #281.
  - **`pages/backups-page.tsx`:** the status card is a definition list, and "Last backup" uses the newest file unless a later run failed. Backups list inside a card. The settings form is `max-w-xl`, with retention in its own group. `RestoreCard` has a `Command` component for copying with `navigator.clipboard`.
  - Tests cover the summary, the folder-based status, and copying a command.

  </details>

- BookOrbit's new logo now shows on the Sources page. ([#308](https://github.com/jshields-ca/LatestArr/pull/308))

  <details>
  <summary>Technical details</summary>

  - Closes #296.
  - `assets/logos/bookorbit.svg` is replaced by `bookorbit.webp` (243×243, 16 KB), BookOrbit's new logo from selfh.st/icons. Upstream removed the SVG on 2026-10-05 and now publishes this logo only as PNG and WebP.
  - `NOTICE.md` has been updated: the file, its source path, and the project link (`bookorbit.app`).
  - The name stays "BookOrbit", one word, as the project writes it. The sample-preview button added in this release says "Read on BookOrbit".

  </details>

- Saving works the same way everywhere, so it's always clear whether you need to press Save. ([#319](https://github.com/jshields-ca/LatestArr/pull/319))

  - **Save buttons** for newsletter details, alerts, backup settings, your profile, and editing a source, SMTP profile, group or recipient:
    - the button is enabled only when something has changed, with **Unsaved changes** beside it;
    - **Ctrl+S** (or **Cmd+S**) saves;
    - you're asked before losing changes: on reload, closing the tab, following a sidebar link, closing the dialog, or collapsing the newsletter.
  - **Editing a recipient:** name, email and groups all save together with **Save changes**, and **Cancel** asks before discarding. A new group typed there is created when you save, and a name that matches an existing group just adds them to it.
  - **Lookback:** an invalid lookback, such as 0 days, now says "Enter a whole number of days, 1 or more." It used to show a raw validation message.

  <details>
  <summary>Technical details</summary>

  - Closes #295. The audit table is on the issue, and the rule is in CONTRIBUTING.md under "Saving".
  - **Shared pieces:**
    - `components/ui/save-actions.tsx` (`SaveActions`);
    - `lib/unsaved-changes.ts`: `useUnsavedChanges` (an app-wide registry plus `beforeunload`), `useSavedSnapshot`, `guardClose`, `confirmDiscard`, `saveShortcutRef` and `useSaveShortcut`.
  - **`saveShortcutRef`** is a React 19 ref with cleanup rather than `onKeyDown`, which jsx-a11y rejects on a `<form>`. It does nothing while the Save button is disabled.
  - **Sidebar links** ask through `confirmDiscard()`. The app uses `BrowserRouter`, so React Router's `useBlocker` isn't available, and the browser's Back button can't be stopped.
  - **Server:** `lookbackDays` validation messages are now a plain sentence.

  </details>

- The design editor is easier to work through, and button styles now reach every button. ([#331](https://github.com/jshields-ca/LatestArr/pull/331))

  - **Where to watch buttons can be filled:** Watch on Plex and Browse movies buttons get their own **Style**. It defaults to Outlined, as they've always been, so existing designs look the same until you change it.
  - **One place for buttons:** a new **Buttons** section has your buttons (with where they go and their style), Where to watch buttons (on or off, where they go and their style), and the look of all buttons: shape, size, Button colour, and Button text.
  - **In the order of the email:** Colours and font, Logo, Layout, Text, Buttons, Item details, Sections, and Custom CSS. The date range and counts line moved to Layout, and the intro and footer note share a Text section.
  - **Easy to review:** each section's header says what's set, like "Cards", "Intro, Footer note", or "6 of 6 shown", so you can check a design without opening everything.
  - **Contrast warnings** for buttons now show with the button options, and check whichever styles are in use.

  <details>
  <summary>Technical details</summary>

  - Closes #330, from release testing in #281.
  - **Server:** `buttons.sourceStyle` (`"filled" | "outline"`, default `"outline"`) in the design settings schema. `button()` uses `style` for the design's own buttons and `sourceStyle` for source buttons and the library link. Saved designs without it get the default, so they render as before.
  - **Web:** `Section` takes a `summary`. New `Group`, `ColourField`, `AccentColours`, and `ChoiceField` components replace `AdvancedColours` and `ButtonStyle`. Fields that share a visible label ("Where they go", "Style") get distinct accessible names. `contrastWarnings` marks button warnings and checks both filled and outlined pairs when both styles are in use.

  </details>

- Importing recipients now shows what will change before anything is saved, and explains the file format. ([#321](https://github.com/jshields-ca/LatestArr/pull/321))

  - **Review first:** after pasting or uploading, **Review** lists the new recipients, name changes for people already on your list, who's already there unchanged, and skipped rows with the reason. Nothing changes until you choose **Import**.
  - **Names update:** a name in the file now updates an existing recipient's name. Before, the row was skipped as "Already exists". A row without a name leaves the existing name alone.
  - **File format help** with a downloadable template.
  - **Spreadsheet-friendly:** a heading row is read by column (Email, E-mail or Email address, plus Name, Full name or Display name), in any order, with other columns ignored. Quoted names like `"Smith, Jane"` stay whole, and cells copied straight from a spreadsheet work too.

  <details>
  <summary>Technical details</summary>

  - Part 1 of #288: format help and a preview before applying.
  - **Server:** `POST /api/recipients/import` takes `dryRun: true` and returns `{ plan: { create, update, unchanged, skipped } }` without writing anything (`planRecipientImport` in `http/routes/recipient-import.ts`).
    - Applying works the plan out again inside one transaction (`applyRecipientImport`), and returns `{ created, updated, unchanged, skipped }`.
    - Emails match existing recipients ignoring case.
  - **Web:**
    - `components/import-recipients-dialog.tsx` has three steps: edit, review and done. Closing with a pasted list asks first.
    - The parser (`lib/recipient-import.ts`) gains `splitCells`, which is quote-aware and splits on commas, semicolons and tabs. It also maps heading rows to columns and drops a leading byte-order mark.

  </details>

- Adding people to a group on the Recipients page is quicker. The dropdown is now a search box. Type part of a name or email to narrow the list (capitals and accents don't matter), then click a person or press Enter to add them. The box stays open, so you can add several people in a row. The list is sorted by name, with numbers first, instead of the order people were added, and inactive people are marked. The recipient list and the edit panel's group list use the same sorting. ([#310](https://github.com/jshields-ca/LatestArr/pull/310))

  <details>
  <summary>Technical details</summary>

  - Closes #287.
  - New `components/ui/combobox.tsx`, an accessible ARIA combobox built on the existing Radix Popover. Focus stays in the text box, the active option is tracked with `aria-activedescendant`, and Arrow keys, Home, End, Enter and Escape work. Up to 50 matches show, with a "type to narrow" note beyond that.
  - New `lib/text.ts`:
    - `compareText`: `Intl.Collator` with numeric sorting and base sensitivity;
    - `foldForSearch` and `matchesSearch`: NFD folding, ignoring case and accents.
  - The recipient table's name and email sort and its search use these too.

  </details>

- Confirmations in LatestArr's own style, and a clearer import summary. ([#333](https://github.com/jshields-ca/LatestArr/pull/333))

  - **Confirmations in the app's own style:** discarding unsaved changes, **Undo last import**, **Edit as code**, and **Unlink SSO** now ask in a LatestArr dialog instead of the browser's plain prompt. Each button says what it does, like **Discard** or **Undo import**.
  - **Clearer import summary:** after an import you see the counts (Added, Updated, Group memberships, Groups created, Skipped) and a separate note about **Undo last import**.
  - **Tidier More colours:** the design editor's extra colours are one per row, so long names like "Label background" no longer wrap.

  <details>
  <summary>Technical details</summary>

  - From release testing in #281.
  - **`components/confirm-dialog.tsx`:** `confirmAction(options)` returns a promise, and one `<ConfirmHost />` is mounted in `App`. Both work like toasts, through a module-level store. With no host mounted, a confirm stays unanswered, which counts as Cancel.
  - **`lib/unsaved-changes.ts`:** `confirmDiscard()` is now async, `askToDiscard()` is new, and `guardClose` closes once the user discards. Sidebar links prevent navigation, ask, then navigate.
  - **`EditRecipientDialog`:** keeps `{ memberIds, newGroups }` against the saved ids, and on Save it updates the details, creates groups, and adds then removes memberships. After a partial failure it reloads their groups.
  - **CONTRIBUTING.md "Saving":** everything in a form waits for its Save, and confirmations use `confirmAction`, never `window.confirm`.

  </details>

- Viewers get a fully read-only view, and everyone can see their role. ([#335](https://github.com/jshields-ca/LatestArr/pull/335))

  - **Read-only means read-only:** on newsletters and designs, every control is disabled for viewers, dropdowns included, and they're never asked about unsaved changes.
  - **Your role:** editors and viewers see a small **Editor** or **Viewer** badge beside their name in the header.

  <details>
  <summary>Technical details</summary>

  - From release testing in #281.
  - **`components/ui/select.tsx`:** Radix's Select opens on pointerdown, which a disabled `<fieldset>` doesn't stop. The wrapper now controls `open`, and refuses to open while the trigger matches `:disabled`, which covers a disabled fieldset as well as its own `disabled` prop. There's a new `select.test.tsx`.
  - **`useUnsavedChanges`:** registered only when the user can edit, in the newsletter details form and the design editor. The design editor's Back button doesn't ask a viewer.
  - **`UserSummary`:** a neutral `Badge` with the role, titled "You have viewer access".

  </details>

### Fixed

- Updated Handlebars, the template engine behind newsletter and design templates, to pick up upstream security fixes. ([#314](https://github.com/jshields-ca/LatestArr/pull/314))

  <details>
  <summary>Technical details</summary>

  - `handlebars` 4.7.9 → 4.7.10, and the server's range raised to `^4.7.10` so older versions can't be resolved.
  - Fixes three JavaScript-injection advisories (Dependabot alerts #71, #72 and #73): an own-property check bypass, AST type confusion in `compile`, and unsafe inline embedding of precompiled templates.

  </details>

- Updated two bundled libraries to pick up upstream security fixes. ([#313](https://github.com/jshields-ca/LatestArr/pull/313))

  <details>
  <summary>Technical details</summary>

  - Lockfile-only bump of two transitive dependencies:
    - `source-map-js` 1.2.1 → 1.2.2 (event-loop denial of service via indexed source-map offsets; reached through mjml and Tailwind);
    - `shell-quote` 1.10.0 → 1.12.0 (command injection in `quote()`; reached only through `@changesets/cli`, a dev tool).
  - Clears Dependabot alerts #69 and #70.

  </details>

- In the design editor, changing **Background** seemed to change the text colour, and changing **Text** the background. The preview was following your browser's dark mode, and a design's dark version uses Text as the background and Background as the text. Previews now have a **Light / Dark** switch, start in Light, and remember your choice. A note under the colour pickers explains how dark mode is worked out. The newsletter preview has the same switch. ([#303](https://github.com/jshields-ca/LatestArr/pull/303))

  <details>
  <summary>Technical details</summary>

  - Fixes #285.
  - An `srcdoc` iframe's `prefers-color-scheme` follows the viewer's browser, so a viewer in dark mode saw `darkPaletteFor()`'s output.
  - New `withPreviewScheme()` (`lib/email-preview.ts`) rewrites the email's `prefers-color-scheme` queries to always-true or never-true, according to the chosen scheme. This also works for code-mode templates with their own dark-mode CSS.
  - New `EmailPreviewFrame` and `PreviewSchemeToggle` (`components/email-preview-frame.tsx`), used by the design editor and the newsletter preview dialog.
  - The choice is kept in `localStorage` (`latestarr:email-preview-scheme`); it falls back to Light when storage is blocked.
  - The sent email is unchanged.

  </details>

- When a design is set to **Link to the library** for sections with nothing new, the section now shows "Nothing new this time." and a **Browse audiobooks** button styled like the design's other buttons, in its accent colour and in dark mode. Before, it was a bare link that didn't match the design. If the section already ends with its own "Watch on Plex"-style button, the browse button is left out so the same link doesn't appear twice. ([#307](https://github.com/jshields-ca/LatestArr/pull/307))

  <details>
  <summary>Technical details</summary>

  - Fixes #292.
  - New Handlebars helper `{{#libraryLinkFor contentType="…" label="…"}}`, which renders its block with `{label, url}` from the linked sources' library address. The else block runs when there's no library address.
  - Built-in designs no longer use `mediaList`'s `emptyFallback="link"`. They render `emptyMessage` plus the secondary `button()` inside `ifAnyItems`'s else block, wrapped in `sourceButtonsFor`'s else block when source buttons are placed per section.
  - `mediaList`'s `emptyFallback="link"` is unchanged for code-mode designs. It now shares the `libraryLink()` lookup.

  </details>

- If LatestArr stopped partway through sending a newsletter (a crash, restart, or upgrade), that newsletter could never send again: every later send said one was "already running". Now, when LatestArr starts, it closes the interrupted send, marks it partly sent or failed, shows who got it in History, and alerts you. Nobody who already got it is sent a duplicate. ([#282](https://github.com/jshields-ca/LatestArr/pull/282))

  <details>
  <summary>Technical details</summary>

  - Fixes #280.
  - New `closeInterruptedSends()` (`pipeline/interrupted-sends.ts`), run by `startScheduler` before refreshing jobs and before catch-up.
    - Each run still `running` becomes `partial_failure`, or `failed` if no recipient was recorded as sent.
    - It sets `finishedAt` and an error that says how many of how many recipients were reached, then logs a warning and sends a failure alert (trigger `interrupted`).
  - Nothing is resent automatically. The interrupted run keeps its `startedAt`, so missed-send catch-up treats that period as sent.
  - A send now records its item and recipient counts before the send loop rather than at the end, so an interrupted send can report "X of Y".
  - Known limit: a recipient whose message the SMTP server accepted in the instant before the stop, but which wasn't yet recorded, shows as not sent.

  </details>

- Line breaks in a design's **Intro** and **Footer note** now show in the preview and in sent emails. Before, every line ran together into one paragraph. A blank line leaves a gap between paragraphs. ([#305](https://github.com/jshields-ca/LatestArr/pull/305))

  <details>
  <summary>Technical details</summary>

  - Fixes #289.
  - New `textWithLineBreaks()` in `render/mjml-template.ts` escapes each line and joins them with `<br>`. One or more blank lines become a single `<br><br>`.
  - `{{introText}}` and `{{footerNote}}` are now bound as a Handlebars `SafeString`, so code-mode designs get the line breaks too. The text is still escaped, so HTML typed into either box shows as text.
  - The plain-text version keeps the breaks, since `<br>` converts to a newline.

  </details>

- On the Recipients page, group changes made in a recipient's edit panel now show straight away in the Groups section below. That covers adding them to a group, removing them, and creating a new group. Before, an open group didn't show the new member, and a group created in the panel wasn't listed until you refreshed the page. ([#304](https://github.com/jshields-ca/LatestArr/pull/304))

  <details>
  <summary>Technical details</summary>

  - Fixes #286.
  - The page now loads groups once and shares them. A `GroupSyncContext` lets the edit panel report a new group (added to the list) and membership changes (which bump a version that open groups reload their members on).
  - Members reloads keep the current list showing and ignore stale responses.

  </details>

- In a design's preview with sample content, the source buttons now match your connected sources, for example "Read on BookOrbit" for a BookOrbit source. Before, the sample always said "Read on BookLore". With no sources connected yet, it shows neutral labels such as "Watch now" and "Read now". ([#306](https://github.com/jshields-ca/LatestArr/pull/306))

  <details>
  <summary>Technical details</summary>

  - Fixes #291.
  - `/templates/preview` loads the source connections (kind, name, public URL) and passes them to `renderDesignSample`.
  - `sampleSourceButtons()` builds the buttons with `buildSourceButtons`, so labels, merging and naming match a real send. A source without a public URL gets a stand-in URL so its button still shows in the sample.

  </details>

- Updated two third-party libraries with published security fixes, so LatestArr isn't exposed to their denial-of-service and address-matching bugs. ([#279](https://github.com/jshields-ca/LatestArr/pull/279))

  <details>
  <summary>Technical details</summary>

  - `ip-address` 10.7.0 → 10.7.3 (via `@fastify/rate-limit`, so it ships in the server): fixes an unbounded parse diagnostic on long input that could stall the process, and `isInSubnet()` comparing IPv4 and IPv6 addresses as one address space.
  - `brace-expansion` 1.1.18 → 1.1.21 and 5.0.9 → 5.0.12 (via `minimatch`, build and lint tooling): fixes stack exhaustion on nested or comma-heavy brace patterns and quadratic-time expansion.
  - Lockfile-only change (`pnpm update --depth Infinity`), within each parent's allowed range. Clears Dependabot alerts #61–#68.

  </details>

- Send statuses read as words, and the design editor fits a phone. ([#336](https://github.com/jshields-ca/LatestArr/pull/336))

  - **Readable statuses:** Recent sends and History said `success`, `failed`, or `partial_failure`. They now say **Sent**, **Failed**, or **Partly sent**, which is amber rather than red, since most of it went out. **Waiting** and **Sending** cover sends that haven't finished.
  - **Design name on phones:** the design editor squeezed the name box to a couple of letters at phone width. It now has its own row, with **Edit as code** and **Save** below it.

  <details>
  <summary>Technical details</summary>

  - **`lib/send-run.ts`:** a `STATUS_LABEL` map, and `partial_failure` uses the `warning` badge variant.
  - **`design-editor-page.tsx`:** the name field gets `min-w-[12rem]`, so the header wraps instead of shrinking it.
  - Found while taking screenshots for latestarr.app.

  </details>

- Signing in with SSO from another address, such as the server's LAN IP, failed with "Missing or expired OIDC sign-in attempt". ([#320](https://github.com/jshields-ca/LatestArr/pull/320))

  <details>
  <summary>Technical details</summary>

  - Refs #317.
  - **`GET /api/auth/oidc/login`** redirects to the `login` URL next to `OIDC_REDIRECT_URI` when the request's host differs. The flow cookie can only be set on the host the provider returns to. The redirect target comes from config, never the request.
  - **Callback errors** redirect to `/login?sso=<outcome>` (or `/?sso=` for linking) under `WEB_ORIGIN`. The outcomes are `expired`, `failed`, `unverified-email`, `not-linked`, `linked`, `link-taken` and `link-failed`. `OidcAccountNotLinkedError` carries a `reason` (`unverified-email`, `no-account` or `inactive`), which is logged.
  - **Linking:**
    - `POST /api/auth/oidc/link` needs a session and passes the same-origin check. It returns the provider URL, and the flow cookie records `link.<userId>`.
    - The callback links only if the same session is still signed in, and refuses an identity that belongs to another account.
    - `DELETE /api/auth/me/sso` unlinks, and is refused for an account without a password.
    - `GET /api/auth/me` adds `ssoLinked` and `hasPassword`.
  - **Web:** `lib/sso.ts` holds the outcome messages. The login page shows the reason, the app shell shows a toast after linking, and the profile has a Single sign-on section.

  </details>

- Clearing a newsletter's subject now saves. It used to keep the old one. ([#327](https://github.com/jshields-ca/LatestArr/pull/327))

- A design with a **Most watched** section couldn't preview or send for newsletters using a Tautulli source. They failed with "Send failed: data.find is not a function". Most watched now shows Tautulli's most played movies and shows again. ([#301](https://github.com/jshields-ca/LatestArr/pull/301))

  <details>
  <summary>Technical details</summary>

  - Fixes #284.
  - With a `stat_id`, Tautulli's `get_home_stats` returns that one stat block as an object, or `[]` when there are no stats. `getHomeStats` expected an array of blocks, so `.find` threw.
  - It now accepts the single block, still searches an array by `stat_id`, and returns `[]` for an empty result.
  - Any other shape (null, a different stat, `rows` that isn't a list) throws a clear "unexpected response" error instead of a `TypeError`.
  - Client, adapter and send-route tests now use Tautulli's real response shape, with tests for the array and unexpected cases.

  </details>

## [0.11.2] - 2026-09-29

### Improved

- LatestArr has a new icon: a postage stamp with an L, lifted off a rose tile. It replaces the envelope and sparkle in the app, the browser tab, and the social previews, and comes in light and dark versions. The app now also has icons for adding it to your phone's or computer's home screen. ([#270](https://github.com/jshields-ca/LatestArr/pull/270))

  <details>
  <summary>Technical details</summary>

  - Chosen in #269, after four exploration rounds (kept on the `design/icon-exploration` branch).
  - `docs/assets/brand/generate.mjs` is the single source for the icon:
    - the brand SVGs (tile, dark, light, maskable, marks, one colour) and PNGs;
    - `apps/web/public` (`favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`);
    - `apps/web/src/components/logo-geometry.ts`, which the in-app `LogoMark` draws from, using per-instance mask IDs.
  - `index.html` adds the PNG favicon, the Apple touch icon, and a `manifest.webmanifest`. The browser theme colour moves to `#c31d4c`.
  - The social images are rendered from `docs/assets/brand/social-preview.html`: `docs/assets/social-preview.png` (1280×640, GitHub and README) and `docs/assets/brand/og-image.png` (1200×630, the website).
  - Usage notes are in `docs/assets/brand/brand.md`.

  </details>

## [0.11.1] - 2026-09-29

### Improved

- LatestArr now points to its new home at [latestarr.app](https://www.latestarr.app). The web UI footer links the website, the docs, GitHub Discussions, issue reporting and the license, and credits LatestArr's contributors, as the site does. The Add source dialog links each source type's setup guide, and the Default design's email footer links LatestArr.app instead of GitHub. ([#258](https://github.com/jshields-ca/LatestArr/pull/258))

  <details>
  <summary>Technical details</summary>

  - **Web UI footer:** the links (LatestArr.app, Docs, Discussions, Report an issue, GPLv3 license) sit in a labelled `nav`, with "© 2026 LatestArr contributors · Led by Jeremy Shields" beneath, linking jeremyshields.ca. The old scootr.ca author link is gone. (#251)
  - **Add source dialog:** a "Setup guide for …" link to that type's page under `latestarr.app/docs/sources`. Plex, BookLore, Grimmory and Audiobookshelf now show the testers note too, linking #244, to match the README; Jellyfin and Emby still link #196.
  - **Code mode:** the variables reference links the code mode guide.
  - **Email footer:** the Default design links `https://www.latestarr.app` (with a globe icon) in place of the repository, and keeps "Report an issue". (#252)
  - **Footer icons fixed:** the email footer icons were never visible. Their SVG stroke colour was written `%23978490` inside base64, where it isn't URL-decoded, so it was an invalid colour. They now use a literal `#978490`.
  - The default design snapshots were re-recorded for the footer change.

  </details>

### Fixed

- LatestArr now checks `ENCRYPTION_KEY` when it starts. If the key is missing or invalid, it stops with a message saying how to generate one. Before, it started anyway, and saving a source or SMTP profile failed with a generic error. ([#259](https://github.com/jshields-ca/LatestArr/pull/259))

  <details>
  <summary>Technical details</summary>

  - `encryptionKeyProblem()` (`apps/server/src/secrets.ts`) requires `ENCRYPTION_KEY` to be base64 that decodes to exactly 32 bytes. `index.ts` logs the problem at `fatal` and exits 1 before touching the database.
  - The wrong-length message warns that credentials already saved need the key they were saved with. (#256)
  - The CI smoke test now starts the container with a generated key, and `CONTRIBUTING.md` describes the new startup error for dev setups where Turborepo's strict env mode drops the key.

  </details>

## [0.11.0] - 2026-09-29

### New

- Designs can be edited as code. On any design, **Edit as code** switches it to hand-written MJML. You start from exactly the markup its options produce, so you never start from a blank page. The code editor highlights Handlebars tags, flags mistakes on the line where they happen before you save, and sits beside the same live preview. A **Variables and helpers** panel lists everything you can use. The intro, footer note, and buttons stay in **Text and buttons**, so they work the same in code designs. ([#209](https://github.com/jshields-ca/LatestArr/pull/209))

  <details>
  <summary>Technical details</summary>

  Closes #200 (part of #199).

  - Editor: CodeMirror 6 (`components/code-editor.tsx`, loaded on demand in its own chunk), with HTML highlighting coloured from the app's theme tokens, Handlebars tags marked, and server-reported issues as lint diagnostics. `components/design-code-reference.tsx` documents the render context and the `mediaList`, `ifAnyItems`, and `ifKindLinked` helpers.
  - Server: `render/code-template.ts` checks code before preview and save. A Handlebars syntax error, or markup MJML can't render at all, is an error (422, with `issues`), shown in plain words with its line. MJML's own validation messages are warnings, since sends still render best-effort HTML. MJML is validated with the `{{ }}` tags blanked out, so line numbers still match.
  - `POST /templates/preview` accepts `mjml` alongside `settings`. `POST /templates/:id/convert-to-code` switches a design to code. `POST`/`PATCH /templates` take an explicit `mode`, and saving a code design with its `settings` no longer turns it back into an options design.
  - Designs list: code designs sit with the others (marked "Code") and duplicate with their code.
  - The built-in design's buttons no longer set `width="auto"`, which MJML flags as invalid. The rendered email looks the same, since the button's table already shrinks to fit.

  </details>

- Several new episodes of the same show now share one row, like "The Daily Show · 4 new episodes", with each episode listed underneath, so a week of a daily show doesn't fill the email. It's on by default, and you can switch it off in a design's Sections settings. Designs you saved earlier keep their "Group by type" setting; turn it on in the design editor to get the new sections. ([#226](https://github.com/jshields-ca/LatestArr/pull/226))

- Design how your newsletters look without drag-and-drop. The new **Designs** page (it replaces Templates) lets you pick colours, font, and layout (cards, compact list, or grid); choose which details each item shows; group items by type in your own order; decide what an empty section shows; add a "Most watched" section; and add custom CSS. A live preview updates as you change things, with sample content or any of your real newsletters. Existing newsletters look exactly as before: they use the Default design, which you can duplicate as a starting point. ([#206](https://github.com/jshields-ca/LatestArr/pull/206))

  <details>
  <summary>Technical details</summary>

  Part of #199 (phases 1 and 2; phase 1's renderer shipped in #205) and closes #197.

  - Web: `pages/designs-page.tsx` (list, with the built-in Default shown first; create from Default, duplicate, delete) and `pages/design-editor-page.tsx` (settings in collapsible sections, with a sticky preview that re-renders 400 ms after the last change through `POST /templates/preview`, ignoring stale responses; unsaved-changes indicator and leave warning; explicit Save). Nav item and route `/designs`; `/templates` redirects there.
  - Newsletter Content panel: `DesignPicker` replaces the Template picker (Default and your designs, with Edit linking to the design editor), saving with an inline `SaveStatus` instead of a toast. The intro, footer note, buttons, and font moved into the design in #207.
  - `lib/design.ts` mirrors the server's design settings shape and defaults (`withDesignDefaults` fills options missing from older saved designs).
  - Server: the ungrouped compact and grid layouts line up with the title, like grouped sections; ungrouped cards stays flush so the Default design's recorded output is unchanged.

  </details>

- Jellyfin and Emby sources, for movies, TV episodes, books, and audiobooks. Add one with an API key. Newsletters show each item's poster, details, and a link that opens it in your server's web app, and you can import the server's users as recipients. **These need testers:** they're built from the published API docs but haven't been tried on a real server yet. If you run Jellyfin or Emby, please [tell us how it went](https://github.com/jshields-ca/LatestArr/issues/196). ([#211](https://github.com/jshields-ca/LatestArr/pull/211))

  <details>
  <summary>Technical details</summary>

  Part of #196 (the issue stays open until both are confirmed on real servers).

  - New `@latestarr/adapter-jellyfin` package: one client over the API Jellyfin and Emby share (`/System/Info`, `/Library/MediaFolders`, `/Users`, `/Items`, `/Items/{id}/Images/Primary`), with two thin adapters, `jellyfin` and `emby`. They differ only in how the key is sent (Jellyfin: `Authorization: MediaBrowser Token="…"`; Emby: `X-Emby-Token`) and in the web app's item link format. The key is never put in a URL.
  - Recent items are sorted by date added (neither server filters on it), requested once per chosen library, and cut at the lookback window. Episodes are titled by series with an `SxxExx - episode` subtitle and use the series poster. Books and audiobooks show their author; audiobooks show their length.
  - Web: both appear in Add source with an API-key hint and a "needs testers" note linking to #196, and support Import users. README marks both "🧪 Needs testers" with a call for testers.

  </details>

- Preview a newsletter before it goes out. The new **Preview** button shows exactly what the next send would contain, with real items, images, and your intro and buttons, without emailing anyone. From the same window you can send a test copy to just yourself. ([#202](https://github.com/jshields-ca/LatestArr/pull/202))

  <details>
  <summary>Technical details</summary>

  Closes #193. `apps/server/src/pipeline/run-newsletter.ts` now separates loading a newsletter (`loadNewsletter`), its SMTP sender (`loadSender`), and rendering from delivery. Real sends, `previewNewsletter`, and `sendTestNewsletter` all use the same render path, so the preview matches the sent email.

  - `POST /newsletters/:id/preview` returns `{ subject, html, items }`. Embedded images (normally `cid:` attachments) are swapped for inline `data:` URIs so a browser can show them. It needs no SMTP profile, creates no send-run, and doesn't affect missed-send catch-up. A failure returns 502 with the same readable reason as Send now and is logged as a warning.
  - `POST /newsletters/:id/send-test` (`{ to }`) sends the render to one address with a `[Test]` subject prefix, with no send-run, and logs `Sent a test of "…" to …` with `trigger: "test"` and the admin's email.
  - Web: `NewsletterPreviewDialog` renders the HTML in a sandboxed `<iframe srcdoc>` (no scripts or same-origin access; popups allowed so the email's links open in a new tab) and prefills the test address with the signed-in admin's email via a new `useOptionalAuth()`.

  This preview is also the live preview the upcoming design editor (#199) and code mode (#200) will build on.

  </details>

- Get alerted when a scheduled newsletter fails. A new **Notifications** page can email you through one of your SMTP profiles, post to Discord, Slack, ntfy, or Apprise, or send generic JSON to your own endpoint. It covers sends that fail entirely, sends that only reach some recipients, and newsletters that can't send at all, for example because their SMTP profile was deleted. Use **Send test alert** to check a destination before saving. ([#204](https://github.com/jshields-ca/LatestArr/pull/204))

  <details>
  <summary>Technical details</summary>

  Closes #195.

  - `apps/server/src/notifications/alerts.ts`: settings live in the `settings` table (key `notifications`), with the webhook URL encrypted like other credentials, since Discord and Slack webhook URLs grant posting rights. `sendFailureAlert` never throws, rate-limits to one alert per newsletter and kind per hour (in memory), and logs each delivery attempt. Formats: Discord `{content}`, Slack `{text}`, ntfy plain-text body with `Title`/`Priority`/`Tags` headers, Apprise `{title, body, type}`, and generic JSON `{event, title, message, newsletter, trigger, sendRunId, time}`. Webhook requests time out after 10s.
  - `run-newsletter.ts` alerts for scheduled and catch-up sends only: on a thrown failure (including `NewsletterMisconfiguredError`, but not an overlapping run or a deleted newsletter), when a send reaches none of its recipients, and on partial failure. Manual Send now never alerts.
  - `GET/PUT /notifications` (the URL is never returned, only `hasUrl`/`urlHost`; an omitted `url` keeps the saved one; `http(s)` only) and `POST /notifications/test`, which tests the settings as entered without saving them.
  - SMTP credential building moved to a shared `mailer/credentials.ts` (`smtpCredentialsFor`), used by the SMTP profile routes, the send pipeline, and alerts.
  - Web: `/notifications` page (nav item "Notifications") with an explicit Save; the only SMTP profile and the admin's email are prefilled. Documented under "Failure alerts" in `docs/self-hosting.md`.

  </details>

- A newsletter can skip its scheduled send when there's nothing new, so recipients don't get an empty email. It's on for newsletters you create from now on; existing newsletters keep sending as before until you turn it on under **Delivery**. Skipped sends show in History as "Skipped (nothing new)", and **Send now** always sends. ([#203](https://github.com/jshields-ca/LatestArr/pull/203))

  <details>
  <summary>Technical details</summary>

  Closes #194.

  - `newsletters.skip_when_empty` (migration `0005_confused_penance.sql`, default `false` so existing rows are unchanged); `POST /newsletters` sets it to `true` unless given, and `PATCH` accepts it.
  - New `skipped` send-run status (the column is TypeScript-enum text, so no migration). In `run-newsletter.ts`, after rendering, a scheduled or catch-up run with zero newly added items and the option on is marked `skipped` without storing HTML or emailing anyone, and logs `Skipped "…": nothing new in the last N days`. The skipped run keeps its `startedAt`, so missed-send catch-up treats it as handled rather than retrying. A custom template's empty-section fallback content doesn't count as "new". Manual Send now is never skipped.
  - Web: a switch in the Details form's Delivery section, saved with **Save changes**; History and the Dashboard show "Skipped (nothing new)".

  </details>

- More than one person can manage LatestArr. The new **Users** page lets you add people with a temporary password, which they replace with their own the first time they sign in. You can also reset passwords, deactivate or reactivate accounts, and delete users. Everyone has full admin access for now. With SSO set up, add someone with the email their provider uses, and they can sign in with SSO straight away. ([#230](https://github.com/jshields-ca/LatestArr/pull/230))

  <details>
  <summary>Technical details</summary>

  Closes #227.

  - Server: `GET/POST /users` and `PATCH/DELETE /users/:id`, admin-only. Users can't deactivate or delete themselves, and a last-active-admin check is kept as a safeguard. Deleting a user clears `templates.createdBy` and keeps the design. Deactivating or resetting a password ends that user's sessions (`deleteUserSessions`). Changes are logged with who made them.
  - Migration `0008_user_management` adds `users.must_change_password`, set on accounts created or reset by an admin. `PATCH /auth/me` clears it on a password change, refuses reusing the current password, and ends the user's other sessions.
  - `getSessionUser` rejects sessions of deactivated users. Login matches email case-insensitively.
  - OIDC links a new SSO identity to an existing active account with the same email when `email_verified` is true. It still never creates accounts once one exists.
  - Web: a Users page (nav item, `/users`) with add, reset-password, deactivate, and delete; `ProtectedRoute` shows a "Choose a new password" screen while `mustChangePassword` is set. The self-hosting guide gains a Users section and notes on SSO linking.
  - The `role` column already allows editor and viewer. Enforcing those roles is a follow-up.

  </details>

- Newsletters can now show where to watch. Designs add a button for each linked source that has a public URL, such as **Watch on Plex**, **Read on BookLore** or **Play on RomM**. You choose where the buttons go: after the items, under each section, or near the top. You can also place your own buttons above the intro, below it, or at the end. ([#238](https://github.com/jshields-ca/LatestArr/pull/238))

  <details>
  <summary>Technical details</summary>

  - New design settings: `content.sourceButtons` `{ enabled (default true), placement: "top" | "sections" | "end" (default "end") }` and `content.ctaPlacement: "beforeIntro" | "afterIntro" (default) | "end"`. With grouping off, "sections" falls back to "end". (#234, #235)
  - `buildSourceButtons` (`render/source-buttons.ts`) builds the buttons from each linked source's public URL only, never its base URL.
    - The verb and service name come from the source type; a Tautulli source's button says Plex.
    - Sources that share a URL become one button.
    - When two buttons would have the same label, each uses its source's name instead. (#234)
  - Source buttons are outlined; your own buttons stay filled.
  - Code-mode designs get `{{#each sourceButtons}}` (`label`, `url`, `kinds`) and the `{{#sourceButtonsFor contentType="movie,tv_episode"}}` helper, both listed in the code reference.
  - The design preview shows sample buttons.
  - The Default design's output is unchanged when no source has a public URL.

  </details>

### Improved

- The Logs page now records what's actually happening: every newsletter send and how many people it reached, recipients that couldn't be delivered to, sources that couldn't be reached, sign-ins and failed sign-in attempts, and each settings change along with who made it. A new `LOG_LEVEL` setting controls how much detail is kept. ([#177](https://github.com/jshields-ca/LatestArr/pull/177))

  <details>
  <summary>Technical details</summary>

  Closes #168. Previously the server had three explicit log calls in total, so the Logs page only ever showed startup lines.

  - **Shared logger** (`apps/server/src/logger.ts`): one pino instance for Fastify, the send pipeline, and the scheduler, so scheduled sends (which have no request) reach the Logs page too. `LOG_LEVEL` (default `info`) is read from the environment and passed through `docker-compose.yml`; an unknown value falls back to `info` with a warning instead of crashing on startup.
  - **Who did it**: `requireAuth` swaps `request.log` for a child logger carrying `user` (the signed-in admin's email), so every line from an authenticated route records the actor.
  - **Sends** (`pipeline/run-newsletter.ts`): `runNewsletter` takes `{ trigger, log }` and logs every outcome exactly once — start, success/partial/total failure with counts and duration, each undeliverable recipient (warn), the specific source that couldn't be fetched (warn), a send with no active recipients or no usable sources (warn), and a refused send (not found / misconfigured / already running) as a warn rather than an error. The send-now route and scheduler no longer log send failures themselves.
  - **Scheduler**: each refresh logs one line listing every enabled newsletter's next run; startup catch-ups are logged and tagged `trigger: "catch-up"`, cron fires `"scheduled"`, and send-now `"manual"`.
  - **Settings changes**: create/update/delete for sources, SMTP profiles, recipients (plus a one-line import summary), groups and memberships, newsletters (with "Enabled"/"Paused" for the toggle and a `fields` list of what changed), templates, and newsletter source/group links. Connection and test-email results for sources and SMTP profiles. Sign-in, failed sign-in (with IP), sign-out, SSO sign-in/rejection, first-admin creation, and password/profile changes.
  - Field names are logged for updates, never values, so passwords and API keys can't leak into logs. Tests assert log levels, the `user`/`trigger` fields, and that a password never appears in the buffer.

  </details>

- The Default design has a fresh look to match the LatestArr app. The newsletter sits on a white card with an accent bar, and the header shows the date range, how many items are new, and a count for each type. Items are grouped into Movies, TV, Books, and so on, with smaller posters, tidier spacing, and summaries trimmed to about two lines. ([#226](https://github.com/jshields-ca/LatestArr/pull/226))

  <details>
  <summary>Technical details</summary>

  Closes #218 and #219.

  - `render/design.ts`: the email is an `mj-wrapper` card with a 4px accent top border on a tinted page (`page` colour, with its own dark-mode rule), with the credits below the card. Cards rows have a 72px poster and hairline dividers, `overviewShort`, and a pill badge. `groupByType` now defaults to true, and TV episodes and seasons share one "TV" section (`contentType="tv_episode,tv_season"`). New option `sections.groupEpisodes` (default true).
  - `render/mjml-template.ts`: `mediaList` takes `groupEpisodes="true"` and comma-separated `contentType`. `ifAnyItems` and `ifKindLinked` accept several types, and `ifKindLinked` is also true when a type has items, so a section never hides real items. New context values: `periodFormatted`, `itemCount`, `kindCounts`, `hasLinkedSources`, and per item `overviewShort`, `episodes`, `episodeCount`, `moreEpisodes`. The code-mode reference documents them.
  - An issue with nothing new and no linked sources says "No new items in this period." instead of rendering nothing.
  - Design editor: a "Group a show's new episodes" switch; the section order lists Movies, TV, Books, Audiobooks, Games and moves TV's two types together; the "lookback line" option is now "Show the date range and counts". The sample preview includes two episodes of one show.
  - Default snapshots re-recorded.

  </details>

- The old drag-and-drop template editor is gone, replaced by designs. Templates you built with it become code designs automatically. They send exactly as before, and you can now edit them in the code editor with a live preview. The web app is also much smaller: the drag-and-drop editor alone was a 2.3 MB download. ([#210](https://github.com/jshields-ca/LatestArr/pull/210))

  <details>
  <summary>Technical details</summary>

  Closes #199.

  - Removed `grapesjs` and `grapesjs-mjml`, `apps/web/src/lib/grapesjs-*` and `pages/template-editor-page.tsx` (and their tests), and the `cdnjs.cloudflare.com` style and font CSP sources the editor's icon font needed. `/templates/:id/edit` redirects to `/designs/:id`.
  - Migration `0007_retire_drag_and_drop` drops `templates.design_json` (the editor's own project state) and `templates.compiled_html` (never read). A template that was never saved from the editor has no markup and always sent with Default, so it becomes an options design with the default settings.
  - `POST /templates` with only a name now creates an options design. `PATCH` changes `mode` only when it's given explicitly, so saving a code design's text and buttons can't turn it back into an options design.
  - README, self-hosting guide, and CONTRIBUTING describe designs instead of drag-and-drop.

  </details>

- Import users works for every source that has users, including Plex, Jellyfin, and Emby. Those servers don't share email addresses, so the import list now has an email field next to anyone without one; fill it in and that person is imported too. Audiobookshelf and RomM sources can now import their users as well, with the emails those servers already have. For Emby, a user linked to Emby Connect with an email address is filled in for you. ([#214](https://github.com/jshields-ca/LatestArr/pull/214))

  <details>
  <summary>Technical details</summary>

  Closes #213.

  - Import users dialog: users without an email get an "Email for {name}" field. A complete address selects them, and clearing it deselects them. Import sends typed addresses alongside the source's own.
  - Audiobookshelf `listUsers`: `GET /api/users` (needs an admin token); active users only, with `email` when set.
  - RomM `listUsers`: `GET /api/users` (needs the client API token's `users.read` scope, which the error message now names on a 401 or 403); enabled users only, with `email` when set.
  - Jellyfin/Emby `listUsers` skips disabled accounts. Emby uses `ConnectUserName` as the email when it is one (untested on a real server; see #196).
  - Import users now appears for Plex, Tautulli, Jellyfin, Emby, Audiobookshelf, and RomM. The BookLore family has no user API over OPDS.

  </details>

- Sources now show each service's own logo, including Jellyfin and Emby, and the Source type list is alphabetical. The setup checklist also suggests failure alerts and a second admin, both optional. ([#236](https://github.com/jshields-ca/LatestArr/pull/236))

  <details>
  <summary>Technical details</summary>

  - Bundled `jellyfin.svg` and `emby.svg` from selfh.st/icons (CC BY 4.0), credited in `assets/logos/NOTICE.md`. (#231)
  - Source types are sorted by display name; the Add source dialog defaults to the first. (#231)
  - A source row's leading icon is the service logo, with the category icon kept as a fallback (`hasSourceLogo`); the type badge is now plain text. (#232)
  - The dashboard checklist adds optional **Get failure alerts** (done when an email or webhook alert is enabled for failures) and **Add another admin** (done with more than one user). Screen readers now hear "Done" on completed steps. (#233)

  </details>

- The Docker image now runs on Node.js 24, the current long-term support release. Node 22 stops getting security fixes in April 2027. Nothing changes for your setup: pull the new image and restart, and your data and settings carry over. ([#215](https://github.com/jshields-ca/LatestArr/pull/215))

  <details>
  <summary>Technical details</summary>

  Closes #186.

  - `docker/Dockerfile`: both stages use `node:24-alpine`.
  - `.nvmrc` and `engines.node` are 24; `@types/node` is `^24.19.0` in every package, matching the runtime (Dependabot still ignores its majors).
  - CI tests on Node 24 and 26 (26 becomes LTS in October 2026); the release workflow runs on 24.

  </details>

- Building or developing LatestArr from source now needs Node.js 22 or newer. Node 20 reached end of life in April 2026. Nothing changes if you run the Docker image, which already uses Node 22. ([#188](https://github.com/jshields-ca/LatestArr/pull/188))

  <details>
  <summary>Technical details</summary>

  `engines.node` is now `>=22` and the CI matrix tests Node 22 (what the Docker image runs) and Node 24 (the next LTS) instead of 20 and 22. This unblocks `jsdom` 30, which requires Node `^22.22.2 || ^24.15.0 || >=26`.

  </details>

- A security review for installs exposed to the internet. The container no longer runs as root, and someone given a temporary password must change it before they can do anything else. Sources and mail servers that stop responding now time out instead of holding up a send, and server errors no longer show internal details. A new guide covers exposing LatestArr safely. ([#239](https://github.com/jshields-ca/LatestArr/pull/239))

  <details>
  <summary>Technical details</summary>

  Found and fixed in the review for #237:

  **Authentication and sessions**
  - `requireAuth` answers `403 password_change_required` to a user with `mustChangePassword`. Before, only the web UI enforced it, and the API still worked.
  - Signing in to an account that doesn't exist now takes as long as a real password check (`verifyDummyPassword`), so response times don't reveal which emails have accounts.
  - First-run setup checks for existing users and creates the admin in one transaction, so two simultaneous requests can't both create an admin.

  **Requests and responses**
  - The same-origin (CSRF) check rejects `Origin: null`, which a sandboxed iframe or `data:` page sends.
  - A new error handler logs server errors in full and returns a generic message, so SQL errors, file paths and stack details never reach the client. Client errors still say what went wrong.
  - A stored copy of a sent email is served with a `sandbox` Content Security Policy.
  - Pino redacts cookies, authorization headers, and password, token, API key and secret fields as a precaution.

  **Outbound requests and content from sources**
  - Every adapter's API requests time out after 30s (`SOURCE_REQUEST_TIMEOUT_MS`); only the Jellyfin/Emby adapter had a timeout before.
  - Poster downloads are capped at 20 MB (`readBytesCapped`), and sharp refuses images over 40 megapixels.
  - BookLore-family covers linked on another host no longer receive the OPDS Basic credentials.
  - SMTP connections time out after 30s (connect and greeting) and 60s (idle socket), down from Nodemailer's 2 and 10 minutes.
  - MJML `ignoreIncludes` is pinned on, so a code-mode design can't use `<mj-include>` to read server files. MJML 5 already defaults to this.

  **Container**
  - The Docker image runs as the `node` user. An entrypoint uses `su-exec` to hand `/app/data` to that user first, so volumes created by older images keep working. The CI smoke test checks both.

  **Tests and docs**
  - `security.test.ts` walks every registered route and requires a 401 without a session, except an explicit public list. It also covers temporary passwords, the bootstrap race, cross-origin and null-origin writes, error hiding, security headers and cookie flags.
  - `docs/self-hosting.md` has a new "Exposing LatestArr to the internet" section.

  Reviewed with no change needed:
  - OIDC: PKCE, state and nonce are checked and the redirect target is fixed.
  - Queries are parameterized.
  - Handlebars (4.7.9) has prototype access off, and every value is escaped.
  - Credentials are encrypted and stripped from responses.
  - Helmet sets a CSP with `frame-ancestors 'self'`.
  - Sign-in and setup are rate-limited.
  - `pnpm audit` finds no known vulnerabilities.

  </details>

- The web UI works better on phones. The Recipients table shows each email under the name instead of cutting it off, dialogs fit the screen and scroll when they're long, buttons no longer squash together, small icons are easier to tap, and iPhones no longer zoom in when you tap a text field. ([#192](https://github.com/jshields-ca/LatestArr/pull/192))

  <details>
  <summary>Technical details</summary>

  Closes #187. Measured every page at 375px wide (horizontal overflow, element widths, tap targets under 24px) before and after.

  - `components/ui/button.tsx`: `size="icon"` buttons get `shrink-0`; they were being squeezed to 23px wide in crowded rows.
  - `components/list-row.tsx`: the actions cluster wraps below `sm` instead of shrinking its children (Sources' four actions didn't fit in 309px).
  - `components/ui/dialog.tsx`: `w-[calc(100%-1.5rem)]` side margins, `max-h-[calc(100dvh-2rem)]` with `overflow-y-auto` (dvh tracks mobile browser toolbars), `p-5 sm:p-6`, and a 32px Close target. Removed the per-page `max-h-[90vh]` overrides this makes redundant. The sheet's Close button gets the same target.
  - `components/ui/input.tsx`, `textarea.tsx`, `select.tsx`: `text-base sm:text-sm`. iOS Safari zooms the page when focusing any field under 16px.
  - Recipients table: below `sm` the Email column is hidden and the address shows as a second line in the Name cell; the Status label is hidden (the switch keeps its `aria-label`); Status and Actions shrink to their content. Sort header buttons get a 28px-tall target.
  - Newsletters: linked-source/group chip "×" buttons (also on Recipients) grow from 16px to 24px without changing chip height.
  - Header GitHub/Star icon buttons grow to 28px targets via `-m-1.5 p-1.5`, so the visuals don't move.

  </details>

- The Add source dialog's example name and addresses now match the source type you pick (for example `http://localhost:8096` for Jellyfin), instead of always showing Tautulli's. A design switched to code no longer opens with about 25 lines of generated dark-mode styles. One short comment stands in for them and adds them when the email is sent; delete it to leave them out. ([#229](https://github.com/jshields-ca/LatestArr/pull/229))

  <details>
  <summary>Technical details</summary>

  Closes #228.

  - `sources-page.tsx`: each source kind has `examples` for the Name, Base URL, and Public URL placeholders, used in the Add and Edit dialogs.
  - `render/design.ts`: `buildDesignMjml(settings, { darkModeMarker: true })` writes a `<!-- latestarr:dark-mode … -->` marker instead of the generated head styles, and `expandDarkModeMarker` replaces it with them at render time. That happens in the send pipeline, previews, and the sample preview. Convert-to-code uses the marker. Code designs without it, including old drag-and-drop templates, are unchanged.

  </details>

- A newsletter's intro, footer note, buttons, and font are now part of its design, set in the design editor where the live preview shows them. The newsletter's settings keep to what goes out, when, and to whom. When you upgrade, each newsletter's existing text, buttons, and font move into a design automatically, so every email looks exactly as before. A newsletter on Default with any of those set gets its own copy of Default, named after it. ([#208](https://github.com/jshields-ca/LatestArr/pull/208))

  <details>
  <summary>Technical details</summary>

  Closes #207 (part of #199).

  - Design settings gain `content: { intro, footerNote, ctas }` (up to 4 buttons, http(s) links only). The pipeline passes them to every template as `{{introText}}`, `{{footerNote}}`, and `{{#each ctas}}`, so code templates keep working. The Default design no longer takes a per-newsletter font.
  - `render/migrate-content-into-designs.ts` runs once at startup (flagged by the `migration.contentIntoDesigns` settings key). Newsletters sharing a design with different text get a copy each; newsletters with no text keep the original. The old `newsletters` columns stay unused for one release so you can roll back.
  - The newsletter API no longer accepts `emailFont`, `introText`, `footerNote`, or `ctas`. The design editor gets a "Text and buttons" section; Save waits until every button is complete, and half-finished buttons are left out of the preview.

  </details>

- Newsletters now include a plain-text version alongside the HTML, which spam filters prefer and text-only email readers can show. The deliverability guide also explains how to check your DKIM record when a received email reports `dkim=temperror` or `dkim=fail`. ([#222](https://github.com/jshields-ca/LatestArr/pull/222))

  <details>
  <summary>Technical details</summary>

  Closes #220.

  - `render/plain-text.ts` converts the rendered HTML with `html-to-text`: wrapped at 78 characters, links shown as `Title [url]`, images and styles dropped. It is generated from the final HTML, so code designs get one too. Sent as `text` on both real sends and test sends, so messages become `multipart/alternative`.
  - `docs/deliverability.md`: a "temperror or fail" section on checking the DKIM selector record, and a note about the text part.

  </details>

### Fixed

- Setting `TRUST_PROXY=true` in `.env` now takes effect. Before, Docker Compose never passed it to the container, so instances behind a reverse proxy saw every visitor as the proxy's IP address (sharing one sign-in rate limit) and didn't mark the session cookie as secure. ([#179](https://github.com/jshields-ca/LatestArr/pull/179))

  <details>
  <summary>Technical details</summary>

  Closes #176. `TRUST_PROXY` was documented in `.env.example` and `docs/self-hosting.md` but missing from `docker-compose.yml`'s `environment:` block, so `process.env.TRUST_PROXY` was always unset inside the container and Fastify's `trustProxy` stayed off. Added `TRUST_PROXY: ${TRUST_PROXY:-}`.

  CI now fails if any key in `.env.example` isn't referenced in `docker-compose.yml`, so a newly documented setting can't be silently dropped again.

  </details>

- Newsletters look right in dark-mode email apps. Emails now say they support light and dark mode, and include dark versions of the design's own colours, so apps like Apple Mail and Outlook.com use those instead of guessing. Type badges have a thin outline, so they stay visible in apps that remove backgrounds (such as Thunderbird's dark message view). ([#224](https://github.com/jshields-ca/LatestArr/pull/224))

  <details>
  <summary>Technical details</summary>

  Closes #216.

  - Designs declare `color-scheme: light dark` (meta tags and `:root`) and always set an explicit body background.
  - For a light design, dark colours are derived from its palette. `@media (prefers-color-scheme: dark)` rules, plus `[data-ogsc]`/`[data-ogsb]` rules for Outlook.com, swap each inline colour by value (e.g. `[style*="color:#241521"]`), so no element needs its own class and custom palettes work too. Palette colours are lower-cased so the selectors match. A design that's already dark only declares support.
  - Badges get a 1px border mixed from the accent colour. The Default design's snapshot changes accordingly.
  - Gmail's apps apply their own dark mode and ignore these styles, so results there vary.

  </details>

- Deleting a design that a newsletter uses no longer fails with an error. Those newsletters switch back to the Default design, and the Designs page now shows which newsletters use each design and says so before you confirm. ([#212](https://github.com/jshields-ca/LatestArr/pull/212))

  <details>
  <summary>Technical details</summary>

  `DELETE /templates/:id` failed with `SQLITE_CONSTRAINT_FOREIGNKEY` whenever a newsletter referenced the design. It now clears those newsletters' `templateId` and deletes the design in one transaction, logging which newsletters changed. `ConfirmDeleteButton` takes an optional `prompt`.

  </details>

- Buttons no longer need a separate "Save buttons" click. They now live in the design and save with everything else. ([#206](https://github.com/jshields-ca/LatestArr/pull/206))

- The Logs page description now matches what it shows (sends, delivery and source problems, sign-ins, and settings changes) and says the log clears when the server restarts. The page also now shows all 500 entries the server keeps, not just the latest 200, and the empty message reflects the level filter. ([#201](https://github.com/jshields-ca/LatestArr/pull/201))

  <details>
  <summary>Technical details</summary>

  Closes #198. The old description promised "source sync errors" (LatestArr never syncs sources in the background; they're only contacted during sends and connection tests) and "routine request traffic is filtered out", which read as false once #177 started logging every settings change. `logs-page.tsx` now requests `limit=500`, the server's buffer size (`apps/server/src/log-buffer.ts`), instead of the endpoint's default of 200, so "latest 500" is accurate. The empty state is per level filter ("No errors since the server last started.").

  </details>

- TV episodes from Plex and Tautulli now show the show's poster instead of a wide video still, so every image in the newsletter is the same shape. Items with no runtime, page count, or rating no longer leave an empty line, and a rating on its own no longer starts with a stray "·". ([#221](https://github.com/jshields-ca/LatestArr/pull/221))

  <details>
  <summary>Technical details</summary>

  Closes #217.

  - Plex uses `grandparentThumb` for episodes, and Tautulli uses `grandparent_thumb`, each falling back to the episode's own `thumb`. Seasons already use their own portrait art.
  - The render context gains `detailsLine`: runtime, pages, length, or platform, then rating, joined with " · ". Designs render the details line only when it has content. The code-mode reference lists `detailsLine`, and the individual fields are unchanged for existing code designs.

  </details>

- Deactivating an account now signs it out immediately; before, an open session kept working until it expired. Sign-in email addresses are no longer case-sensitive. ([#230](https://github.com/jshields-ca/LatestArr/pull/230))

- The main button on each page now glides up on hover and eases when pressed, instead of jumping into place. ([#241](https://github.com/jshields-ca/LatestArr/pull/241))

  <details>
  <summary>Technical details</summary>

  - Tailwind v4 compiles `hover:-translate-y-0.5` and `active:scale-[0.98]` to the separate `translate` and `scale` properties, but `button.tsx` only transitioned `transform`.
  - The transition list now names `translate` and `scale`, so the lift and press use the intended spring easing. (#240)

  </details>

- The GitHub star in the header glows and grows on hover again. Its one-time pulse when the page loads had been switching the hover effect off. ([#243](https://github.com/jshields-ca/LatestArr/pull/243))

  <details>
  <summary>Technical details</summary>

  - `.star-glow-intro` used animation fill mode `both`, so the finished pulse kept applying its last frame, and that overrode the hover and focus styles on `.star-glow`.
  - It now uses `backwards`. The pulse ends at the resting state, so nothing needs holding. (#242)

  </details>

## [0.10.0] - 2026-09-23

### New

- Import a Plex or Tautulli source's known users as recipients, grouped together, from the Sources page. ([#147](https://github.com/jshields-ca/LatestArr/pull/147))

  <details>
  <summary>Technical details</summary>

  `SourceAdapter` (`packages/adapters/core/src/source-adapter.ts`) gains an optional `listUsers?(config): Promise<SourceUser[]>`, the same optional-capability pattern as `fetchPopularItems`/`fetchImageBytes`. Implemented for:

  - **Tautulli**, via its `get_users` API (`getUsers` in `tautulli-client.ts`) — includes each user's `email` when Tautulli has it (synced from the underlying Plex server's shared-user list), filtering out its "Local" pseudo-user (id 0).
  - **Plex**, via the local server's own `/accounts` endpoint (`getAccounts` in `plex-client.ts`) — usernames only, no email. A local server token can't reach plex.tv's own account API, which is the only place a shared user's email is visible; `SourceUser.email` is optional specifically to let a caller (and `NewItem`'s doc comment) handle this per-source gap rather than assuming every source can supply one.

  New `GET /sources/:id/users` (`apps/server/src/http/routes/sources.ts`) 404s (not a 200 with an empty array) when the adapter doesn't implement `listUsers`, so the web UI can tell "unsupported" apart from "zero users right now."

  New "Import users" action on a Plex/Tautulli source row (`apps/web/src/pages/sources-page.tsx`) opens a dialog listing the source's users — pre-checked when they have an email, disabled when they don't (a recipient can't exist without one) — and imports the selected ones via the existing bulk-import endpoint (`POST /recipients/import`, from the CSV/text-paste import feature), then adds each newly-created recipient to a group named after the source, reusing an existing group of that name on a repeat import rather than creating a duplicate.

  </details>

- Newsletters can now include an intro note, a footer note, and up to 4 call-to-action buttons (e.g. a link to your Plex/Jellyfin app, a donation link, "browse the library") in the default template. ([#173](https://github.com/jshields-ca/LatestArr/pull/173))

  <details>
  <summary>Technical details</summary>

  Addresses the feature request in #163, folded in alongside the default-template visual refresh (#162).

  - Three new `newsletters` columns — `intro_text`, `footer_note` (both nullable text), `ctas` (nullable JSON `{label, url}[]`, migration `0004_busy_ares.sql`) — validated server-side via zod in `apps/server/src/http/routes/newsletters.ts` (`ctas` capped at 4, `url` must be a valid URL, `label` 1-40 chars).
  - `apps/server/src/render/newsletter-template.ts`: intro text renders as a line under the "Here's what's new" intro; CTAs render as a row of `<mj-button>` elements (native MJML, so Outlook VML fallbacks come for free) right below that; the footer note renders as its own line above the existing "Generated by LatestArr" credit. All three are also passed through generically to `renderMjmlTemplate` (`apps/server/src/render/mjml-template.ts`) so a custom GrapesJS-authored template could reference `{{introText}}`/`{{footerNote}}`/`{{#each ctas}}` directly, though only the default template does today.
  - Web UI: two new components on the Newsletters page's Content panel (`apps/web/src/pages/newsletters-page.tsx`) — `NewsletterTextField` (shared by Intro and Footer note, saves on blur only when the value actually changed) and `CtaButtonsField` (a row-editor list with an explicit "Save buttons" button, since a half-typed URL blurring mid-edit shouldn't silently commit). Both hidden once a custom template is picked, same as the existing Font picker.
  - Icon support per CTA (raised in the original request) was intentionally left out of this pass — email-safe icon rendering (inline SVG/data-URI, per the footer icons added in #162) adds real scope for a picker UI, and label+URL alone already covers the core use case.

  </details>

- The Edit recipient dialog now lets you add or remove group membership — and create a brand-new group — without leaving the dialog. ([#169](https://github.com/jshields-ca/LatestArr/pull/169))

- A Logs page in the web UI shows recent server activity — failed sends, source sync errors, auth events, and anything else worth troubleshooting — without needing to `docker logs` the container. ([#149](https://github.com/jshields-ca/LatestArr/pull/149))

  <details>
  <summary>Technical details</summary>

  The server's pino logger now writes to two destinations via `pino.multistream`: stdout (unchanged — still what `docker logs` shows) and a new in-memory ring buffer (`apps/server/src/log-buffer.ts`, capped at 500 entries), which drops Fastify's routine per-request "incoming request"/"request completed" pair so the buffer holds actual events instead of being drowned out by ordinary traffic. New `GET /logs` (`?level=warn|error|...` and `?limit=`) serves recent entries with a human-readable level label.

  The new Logs page polls this on load/refresh/filter-change, showing each entry's level (color-coded), timestamp, and message, with a "Details" toggle that expands the entry's full raw context (request info, error type/message/stack) for whichever ones carry it.

  Note for anyone extending `apps/server/src/app.ts`: pino's actual destination is its *second* constructor argument — `pino(multistreamResult)` alone silently falls back to pino's own default stdout destination and never writes to any custom stream in the multistream array; it has to be `pino(options, multistreamResult)`. Confirmed via a minimal repro while building this — easy to get wrong and have it look like it's working (the primary stdout destination still logs normally) while the second destination silently receives nothing.

  </details>

- Bulk-import recipients by pasting a list of emails or uploading a CSV, instead of adding people one at a time. ([#146](https://github.com/jshields-ca/LatestArr/pull/146))

  <details>
  <summary>Technical details</summary>

  New "Import" button on the Recipients page opens a dialog with a paste area (or an "Upload CSV" button that reads a file's text into the same field). `apps/web/src/lib/recipient-import.ts` parses the pasted/uploaded text tolerating the formats people actually paste: one bare email per line, `email,Name` or `Name,email` CSV-style pairs (either order), `Name <email>` mailto-style entries, and a flat comma/semicolon-separated address list copied straight from a mail client's To field — with a live "N recipients ready to import, M lines couldn't be parsed" preview and the unparseable lines shown before anything is submitted.

  New `POST /recipients/import` (`apps/server/src/http/routes/recipients.ts`) accepts the parsed rows and processes them one at a time rather than as a single multi-row insert, so one bad or duplicate row doesn't fail the whole batch — it returns which rows were `created` and which were `skipped` with a reason (invalid email, already exists, or duplicate within the same import), which the dialog displays after submitting.

  </details>

- Recent Sends history now shows exactly who a send went to and what it included, with a link to the actual rendered copy — not just aggregate counts. ([#148](https://github.com/jshields-ca/LatestArr/pull/148))

  <details>
  <summary>Technical details</summary>

  `send_runs` gains two columns, set once rendering succeeds (independent of whether individual recipient deliveries later fail): `items_snapshot` (a lightweight `{title, kind}[]` JSON snapshot — the same set `item_count_included` has always counted, now also captured with titles) and `rendered_html` (the actual HTML that was sent, stored verbatim rather than re-rendered on demand, so it reflects exactly what a recipient received even if templates/sources changed since).

  Per-recipient detail already existed in `send_run_recipient_results` (populated by the send pipeline, but never exposed) — new `GET /newsletters/:id/send-runs/:runId/recipients` joins it with `recipients` for each row's email/displayName. New `GET /newsletters/:id/send-runs/:runId/html` serves the stored `rendered_html` directly as `text/html` (a link target, not a JSON-fetched value). The existing list endpoint (`GET /newsletters/:id/send-runs`) explicitly excludes `rendered_html` from each row — it can be tens to hundreds of KB and the list can return many runs at once.

  The newsletter History tab's send-run rows gain a "Details" toggle (only shown when there's something to show) that lazily fetches recipients and renders included-item badges, a per-recipient status list, and a "View a copy of this send" link to the raw HTML endpoint.

  </details>

### Improved

- The expanded newsletter row is now organized into two clearly labeled panels — Schedule (with its own Delivery subsection) and Content (Template/Sources/Groups) — instead of one long stack of boxes, and the collapsed row's schedule line now highlights the frequency and time instead of reading as one flat muted sentence. ([#161](https://github.com/jshields-ca/LatestArr/pull/161))

  <details>
  <summary>Technical details</summary>

  Addresses production feedback that the Details tab (`NewsletterDetailsForm`/`NewsletterCard` in `apps/web/src/pages/newsletters-page.tsx`) dumped everything — Name, Schedule, Delivery, Subject template, Template, Sources, Groups — as one flat vertical stack, and that the collapsed row's summary line (e.g. "Weekly on Monday at 8:00 AM (America/Winnipeg) · 7-day lookback") was a single undifferentiated muted string.

  - Added `describeScheduleParts()` (`apps/web/src/lib/schedule.ts`) — same parsing as the existing `formatScheduleForDisplay`, but returns `{ frequency, when, timezone }` separately instead of one sentence, so the collapsed row can render frequency as a `Badge` and the day/time in a bolder weight, with timezone/lookback staying muted.
  - Restructured the expanded Details tab into a `sm:grid-cols-2` layout: the left column is `NewsletterDetailsForm` (Name, then a "Schedule" panel containing the existing `ScheduleField` — cron/advanced toggle unchanged — plus a nested "Delivery" subsection for lookback/SMTP profile/subject template); the right column is a new "Content" panel wrapping the existing `TemplatePicker`/`LinkedSources`/`LinkedGroups` (unchanged behavior — same add-via-dropdown, remove-via-chip pattern). Stacks to one column below `sm`.
  - No functional changes to any picker or the schedule/cron logic — this is a layout and typography pass only.

  </details>

- The Logs page now looks and behaves like an actual console — a dense, monospace-font scrolling view instead of separated card panels — and can auto-refresh live instead of requiring a manual Refresh click. ([#156](https://github.com/jshields-ca/LatestArr/pull/156))

  <details>
  <summary>Technical details</summary>

  Addresses production feedback on the v0.9.0+dev Logs page (`apps/web/src/pages/logs-page.tsx`):

  - Replaced the bordered-card `LogRow` list with a single terminal-style panel (`bg-zinc-950`, `divide-y divide-zinc-900`) where each entry is one line: `HH:MM:SS  LEVEL  message`, level-colored text instead of a badge, expandable inline via a chevron for entries with extra fields (error details, request metadata).
  - Added a JetBrains Mono web font (`index.html`'s existing single Google Fonts request, `--font-mono` in `index.css`'s `@theme inline` block) so the console view and any future code/log surface can reach for `font-mono`.
  - Added a "Live" toggle button that polls `GET /logs` every 3s while enabled (`setInterval` in a `useEffect` keyed on `[live]`, cleared on toggle-off/unmount); polling reuses the existing level filter and refreshes silently (no full-page loading spinner) so it doesn't flicker mid-tail.

  </details>

- The default newsletter template now looks more like LatestArr — bigger, more readable text, warmer Bloom-tinted colors instead of generic gray, a restyled footer with small GitHub/Report-an-issue icons — and each newsletter can now pick which font it sends with (Ubuntu, Arial, Georgia, or Verdana). ([#165](https://github.com/jshields-ca/LatestArr/pull/165))

  <details>
  <summary>Technical details</summary>

  Addresses production feedback after reviewing a real test send's raw .eml: font sizes felt too small for comfortable/accessible reading, the palette (`#0f172a`/`#64748b`/`#94a3b8`/`#999999`) read as generic rather than Bloom, and the footer was two bare text links.

  - `apps/server/src/render/newsletter-template.ts`: bumped font sizes across the per-item card and header/footer (title 24→28px, item title 16→18px, subtitle 13→14px, overview 13→14px, meta lines 11-12→12-13px), replaced the generic slate palette with the app's own Bloom neutrals (`TEXT_COLOR`/`MUTED_COLOR`/`SUBTLE_COLOR`, derived from `--foreground`/`--muted-foreground`), added a soft tinted fill to the content-kind badge, and rebuilt the footer as a bordered row with small inline-SVG (data: URI) GitHub/report icons next to the existing links — `ACCENT_COLOR` itself was already exactly the app's `--primary`, unchanged.
  - Added a small **Font** picker (`apps/server/src/render/email-fonts.ts`'s `EMAIL_FONTS` catalog: Ubuntu, Arial, Georgia, Verdana — curated web-safe stacks, not arbitrary font upload, which email clients don't support reliably) as a new `newsletters.email_font` column (`packages/db/src/schema.ts`, migration `0003_grey_stardust.sql`, default `"ubuntu"`), validated server-side via a zod enum in `apps/server/src/http/routes/newsletters.ts`, and exposed in the web UI as `EmailFontPicker` next to the existing Template picker in the Newsletters page's Content panel — hidden once a custom template is picked, since a GrapesJS-authored template defines its own fonts.
  - Found along the way: MJML's `<mj-attributes>`/`<mj-all>` defaults aren't honored by the installed `mjml` version for `<mj-text>`'s `font-family` — worked around by setting `font-family` explicitly on every `<mj-text>` tag and in the raw per-item/footer markup instead of relying on template-wide defaults.
  - Scoped to the default template only — the GrapesJS "Media List" block (`apps/web/src/lib/grapesjs-blocks.ts`) that a custom template can use keeps its existing appearance; restyling it was out of scope for this pass.

  </details>

- The dashboard's setup checklist collapses to a thin, full-width bar once setup is complete, positioned above the stat tiles instead of sharing a half-width row with Recent sends — and every dashboard card now uses the same circular icon-chip treatment instead of a mix of bare icons and colored tiles. ([#144](https://github.com/jshields-ca/LatestArr/pull/144))

  <details>
  <summary>Technical details</summary>

  Two related changes to `apps/web/src/pages/dashboard-page.tsx`:

  - The checklist card and its collapsed "Setup complete" summary were two separately-shaped `Card`s swapped in and out of a two-column grid alongside Recent sends, so the collapsed state still took up as much horizontal room as the full checklist. They're now one `Card` — a single header (icon chip + title + toggle) with conditionally-rendered content — functioning as a real accordion: one row tall when collapsed, positioned in its own full-width row above the stat tiles.
  - Introduced a shared `CardIconChip` component (the circular tinted-background icon treatment the stat tiles already used) and applied it to the checklist header and the Recent sends header too, replacing a bare `CheckCircle2`/no icon at all. Added `emerald` and `tertiary` entries to the accent palette (renamed from `STAT_ACCENTS` to `CARD_ICON_ACCENTS`) for the checklist's "done" state and to match Recent sends' existing tertiary-glass card tint.

  </details>

- The Recipients page is now a dense, sortable table with a search box and real pagination — click Name/Email/Status to sort, search narrows results live, and large lists page 25 at a time — instead of one long scrolling list of cards. ([#158](https://github.com/jshields-ca/LatestArr/pull/158))

  <details>
  <summary>Technical details</summary>

  Addresses production feedback that a real-world recipient list (~50 rows from a Tautulli user import) made `apps/web/src/pages/recipients-page.tsx`'s flat card list hard to navigate. A few layout options were sketched and reviewed before picking this one.

  - Replaced the per-recipient `ListRow` cards with a `<table>` (`RecipientTableRow`), each row: Name, Email, an inline Active/Inactive `Switch`, and Edit/Delete actions.
  - Added click-to-sort column headers (`SortableColumnHeader`) for Name/Email/Status, toggling ascending/descending on repeat clicks, with proper `aria-sort` on each `<th>` and a visible up/down/unsorted icon.
  - Added a client-side search box (`matchesRecipientQuery`) filtering by email or display name, case-insensitive substring match — no API changes, `listRecipients()` still fetches the full list once.
  - Replaced incremental "Show more" with real Previous/Next pagination (`RECIPIENTS_PAGE_SIZE = 25`), resetting to page 1 whenever the search query changes.
  - Header shows a live count ("N recipients" / "N of M match" while searching).

  </details>

- The newsletter row is easier to act on: "Send now" and the "Enabled" toggle now sit in the row header next to Delete, so neither needs the row expanded, and Send now no longer sits crowded next to "Save changes". ([#171](https://github.com/jshields-ca/LatestArr/pull/171))

  <details>
  <summary>Technical details</summary>

  Closes out the remaining part of #167 (the button-crowding and Send-now-visibility parts were addressed separately). The toggle was a small control that didn't need a whole `SettingRow` to itself; moved it into `NewsletterCard`'s header `actions` (`apps/web/src/pages/newsletters-page.tsx`) as a compact `<label>`-wrapped `Switch`, and removed the now-empty standalone row.

  </details>

- The Dashboard's "Recent sends" card now shows the same expandable send detail as the Newsletters page's History tab — included items, per-recipient delivery status, and a link to view a copy of the sent HTML — instead of just a status line. ([#157](https://github.com/jshields-ca/LatestArr/pull/157))

  <details>
  <summary>Technical details</summary>

  Addresses production feedback that the enhanced send-run history from the Newsletters page (added in #137/#148) wasn't reflected on the Dashboard.

  Extracted the newsletters-page's `SendRunHistoryList`/`SendRunDetails` pair into a shared `apps/web/src/components/send-run-history.tsx`, dropping the separate `newsletterId` prop in favor of reading it off `run.newsletterId` (already present on every `SendRun`) so the same list can render runs spanning multiple newsletters. Added an optional `newsletterName` field the Dashboard's cross-newsletter feed populates and the per-newsletter History tab leaves unset. `apps/web/src/pages/newsletters-page.tsx` and `dashboard-page.tsx` both now import from the shared module instead of each keeping their own copy — `dashboard-page.tsx`'s old flat `RecentRunRow` is gone.

  </details>

- The Edit SMTP profile dialog is now split into Connection / Authentication / Sender identity tabs instead of one long scrolling form. ([#143](https://github.com/jshields-ca/LatestArr/pull/143))

  <details>
  <summary>Technical details</summary>

  Same pattern as the newsletter edit page's Details/History split (`newsletters-page.tsx`) — the Port & encryption group (port field, the always-visible port-convention reference, and the implicit-TLS switch) took up a lot of vertical space on its own, which is what made the dialog feel cramped as a single stacked view. `EditSmtpProfileDialog` in `apps/web/src/pages/smtp-profiles-page.tsx` now wraps Host/Port/encryption, Username/Password, and From name/From email in `Tabs`, with Name staying outside the tabs since it's the profile's own label. The Add SMTP profile dialog is unchanged — it's shorter and wasn't the one reported as cramped.

  </details>

### Fixed

- A book's release year from Book Orbit/BookLore could show one year earlier than its actual publication year, for anyone self-hosting in a timezone west of UTC. ([#170](https://github.com/jshields-ca/LatestArr/pull/170))

  <details>
  <summary>Technical details</summary>

  `mapEntry()` in `packages/adapters/booklore-family/src/booklore-adapter.ts` built `releaseDate` from OPDS's `dc:issued` field via `new Date(issued)`. `dc:issued` only ever appears as a bare 4-digit year (e.g. `"2020"`), and `new Date("2020")` parses that as UTC midnight — reading it back with local-time getters (`getFullYear()`, `toLocaleDateString()`, ...) in any negative-UTC-offset timezone rolls it back to December 31 of the previous year.

  Also the root cause of a flaky test (`booklore-adapter.test.ts`'s "maps entries and filters by the since cutoff", filed as #164) that only failed on a non-UTC-configured machine.

  Fixed by constructing the date in local time (`new Date(Number(issued), 0, 1)`) when `dc:issued` is a bare year, so the year survives the round trip regardless of the host's timezone. A full date string, should one ever appear, still goes through the plain `Date` parser unchanged.

  </details>

- The page footer now stays pinned to the bottom of the browser window on short pages instead of sitting mid-page above empty background. ([#139](https://github.com/jshields-ca/LatestArr/pull/139))

  <details>
  <summary>Technical details</summary>

  The design-polish-round-2 layout change (#125) dropped `flex-1` from the header/sidebar/main content row to fix a different bug — an explicit `h-[calc(100vh-3.5rem)]` height on `aside` was forcing that row to a full viewport height regardless of the footer, causing scroll dead-space on short pages. Removing `flex-1` fixed that but introduced this one: without it, the content row no longer grows to fill leftover space in the `min-h-screen` flex column, so `AppFooter` renders right after short content instead of at the bottom of the viewport.

  Restored `flex-1` on the content row (`apps/web/src/components/app-shell.tsx`) without restoring `aside`'s explicit height — `flex-1` alone (paired with `min-h-screen` on the root) fills exactly the space the header and footer leave, with no explicit-height side effect that would force `100vh` regardless of footer height.

  Also fixed the local dev proxy (`apps/web/vite.config.ts`): `changeOrigin: true` rewrote the outgoing `Host` header to match the API server but left `Origin` as the Vite dev origin, which tripped the server's same-origin CSRF check (`requireSameOrigin`) on every mutating request when running `apps/web` and `apps/server` as separate dev servers. The proxy now rewrites `Origin` to match too.

  </details>

- The Recipients table's Name column no longer reads as cramped against the left border. ([#169](https://github.com/jshields-ca/LatestArr/pull/169))

  <details>
  <summary>Technical details</summary>

  - `apps/web/src/pages/recipients-page.tsx`: the Name `<td>` was missing the left padding its `<th>` had (`px-4` vs `pr-4`-only), so header text sat indented while row text sat flush against the border.
  - Added `GET /recipients/:id/groups` (`apps/server/src/http/routes/recipients.ts`) — the reverse of the existing `GET /recipient-groups/:id`'s `members`, so a recipient-centric UI doesn't need to fetch every group's member list to figure out which ones a given recipient is already in.
  - Added `RecipientGroupsField` to `EditRecipientDialog`, mirroring the Newsletters page's `LinkedGroups` pattern (add-via-dropdown, remove-via-chip) plus an inline "create a new group" shortcut that creates and adds in one action. Reuses the existing `POST/DELETE /recipient-groups/:id/members` endpoints — no new mutation endpoints needed.

  </details>

- SMTP profile cards now correctly label STARTTLS connections (e.g. port 587) instead of showing a misleading "No TLS", and give the "Authenticated" badge success styling instead of neutral. ([#142](https://github.com/jshields-ca/LatestArr/pull/142))

  <details>
  <summary>Technical details</summary>

  The connection-security badge only checked the `secure` boolean (implicit TLS, i.e. port 465), so any STARTTLS profile — the common case for providers like Dreamhost on port 587 — showed "No TLS" even though the connection is encrypted, just via an upgrade after the initial handshake rather than from the start. `connectionSecurityLabel()` in `apps/web/src/pages/smtp-profiles-page.tsx` now also checks `port`, matching the existing `PORT_GUIDE` convention (465 → Implicit TLS, 587 → STARTTLS, anything else → No TLS), and gives both TLS variants `success` badge styling. The "Authenticated" badge also switches from `neutral` to `success` when `hasAuth` is true.

  </details>

## [0.9.0] - 2026-09-21

### New

- Items in a sent newsletter are clickable. A movie, show, book, audiobook or game links straight to that item on its source: Plex, Tautulli, Audiobookshelf, RomM, or a BookLore-family app. ([#127](https://github.com/jshields-ca/LatestArr/pull/127))
- Sources have an optional **Public URL**, the address recipients' links use, for when a source's own address isn't one they can open. For example, Tautulli's address is its API, not the Plex page people want, and a Tailscale or LAN address doesn't work from outside your network. ([#127](https://github.com/jshields-ca/LatestArr/pull/127))

### Improved

- Editing a newsletter has two tabs. **Details** holds every setting, now including its template, sources and recipient groups, and **History** shows its sends. ([#124](https://github.com/jshields-ca/LatestArr/pull/124))
- The default layout opens with a short line under the title ("Here's what's new in the last 7 days.", using the newsletter's lookback). Its footer links to the project on GitHub and to where to report an issue. ([#123](https://github.com/jshields-ca/LatestArr/pull/123))
- A clearer look. ([#125](https://github.com/jshields-ca/LatestArr/pull/125))

  - **Wordmark:** larger and solid instead of a gradient, with "Latest" bold and "Arr" lighter.
  - **Motion:** a gentler light sweep on buttons, and a clear pop and glow on the GitHub star.
  - **Blue accent:** used in a few more places, such as the header's version and GitHub links.

### Fixed

- Every item in a newsletter has a badge saying what it is: **Movie**, **TV Episode**, **TV Season**, **Game**, **Book** or **Audiobook**. Before, only books, comics, audiobooks and podcasts had one. ([#123](https://github.com/jshields-ca/LatestArr/pull/123))
- A new TV season shows the show's name as its title, with "Season 1" underneath. Before, it showed just "Season 1". ([#123](https://github.com/jshields-ca/LatestArr/pull/123))
- On pages with little content, the footer sits right after it instead of being pushed below the screen. ([#125](https://github.com/jshields-ca/LatestArr/pull/125))

<details>
<summary>Technical details</summary>

- **Links:** a new `publicUrl` column on source connections. Every adapter now sets `externalUrl` where its app has a page for an item:
  - Plex and Tautulli use Plex Web deep links, built from the server's machine identifier.
  - Tautulli without a Public URL makes no links, since its address is its API.
  - BookLore-family entries use their OPDS permalink, rebased onto the Public URL.
  - Audiobookshelf uses `/item/<id>` and RomM uses `/rom/<id>`.
- **Safety:** link schemes are checked, so a source can't put a `javascript:` link into an email.
- **Rendering:** the default layout wraps an item's title and poster in its link.

</details>

## [0.8.0] - 2026-09-20

### New

- An **All New (This Period)** block for the template builder. Drop it in, and it shows everything added recently, grouped by type, instead of six separate blocks to add and set up. ([#118](https://github.com/jshields-ca/LatestArr/pull/118))

### Improved

- A more polished look. ([#119](https://github.com/jshields-ca/LatestArr/pull/119))

  - **Buttons:** a subtle light sweep and a softer lift on hover.
  - **Logo:** more prominent, with the version, GitHub and star links beside it on phones too.
  - **Navigation:** the current page has a clear accent bar in the sidebar.
  - **Footer:** a real page footer with the license, the author and a link to report an issue, replacing the hidden "About" icon.
  - **Colour:** a calm blue accent for informational badges, such as the version number.

### Fixed

- Saving a template no longer rebuilds the whole editor in the background, which could cause glitches. ([#122](https://github.com/jshields-ca/LatestArr/pull/122))

## [0.7.1] - 2026-09-20

A maintenance release with no changes to how LatestArr works. It updates core libraries to their next major versions: React, the scheduler, the database driver and the image library, plus the build and test tools.

<details>
<summary>Behind the scenes</summary>

- **Runtime libraries:**
  - React and React DOM 18 → 19 ([#115](https://github.com/jshields-ca/LatestArr/pull/115));
  - croner, the scheduler, 9 → 10, checked against missed-send catch-up ([#116](https://github.com/jshields-ca/LatestArr/pull/116));
  - better-sqlite3, the database driver, 11 → 12.11.1. 13 would have dropped Node 20. ([#117](https://github.com/jshields-ca/LatestArr/pull/117));
  - sharp 0.34 → 0.35 ([#111](https://github.com/jshields-ca/LatestArr/pull/111)).
- **Build and test tools:**
  - Vite 8, Vitest 5 and the React plugin 6 ([#114](https://github.com/jshields-ca/LatestArr/pull/114));
  - ESLint 10 and jsdom ([#112](https://github.com/jshields-ca/LatestArr/pull/112)).

</details>

## [0.7.0] - 2026-09-19

### New

- Newsletters show posters and covers from every source. Before, only RomM's games had them, which was the most common feedback on 0.6.0. ([#107](https://github.com/jshields-ca/LatestArr/pull/107))

  Images are fetched by LatestArr and attached to the email. Recipients' mail apps never contact your servers, and your sources' addresses and credentials never appear in an email.

- Saving and errors are confirmed the same way on every page, with a short pop-up message. ([#108](https://github.com/jshields-ca/LatestArr/pull/108))

### Improved

- A design refresh, from 0.6.0 feedback. ([#108](https://github.com/jshields-ca/LatestArr/pull/108))

  - **Type:** Plus Jakarta Sans for text, and the Newsreader serif for each page's title.
  - **Hierarchy:** section labels are small capitals, so they stand apart from bold text.
  - **Colour:** a restrained violet accent.
  - **Depth:** a frosted-glass look on dialogs, menus and pop-ups.

- The header holds your account and the project links. ([#106](https://github.com/jshields-ca/LatestArr/pull/106))

  - **Account:** your name, email, **Edit profile** and **Sign out** moved from the cramped sidebar into the header, so your email no longer gets cut off.
  - **Star:** opens a short note on why starring helps, instead of jumping straight to GitHub.

### Fixed

- TV episodes lead with the series name, with "S01E01 - Episode name" underneath, for Plex and Tautulli. Before, the series name was buried below the episode's own title. ([#107](https://github.com/jshields-ca/LatestArr/pull/107))

<details>
<summary>Technical details</summary>

- **Posters:**
  - Plex reads `thumb`;
  - Tautulli reads `thumb` and `art` through its `pms_image_proxy`;
  - Audiobookshelf reads `media.coverPath`;
  - the BookLore-family adapter parses OPDS image links.
- **Embedding:** at send time, `pipeline/embed-images.ts` fetches each image with the source's stored credentials (`SourceAdapter.fetchImageBytes`), resizes it with `sharp`, and attaches it as a CID image. Only images that make it into the rendered email are fetched.
- **Toasts:** built on Radix Toast.

</details>

## [0.6.0] - 2026-09-16

### New

- More building blocks in the template builder. ([#89](https://github.com/jshields-ca/LatestArr/pull/89))

  - **Presets:** ready-made sections for Movies, TV episodes, TV seasons, Books, Audiobooks and Games.
  - **Spacing:** a **Divider** and a **Spacer**.
  - **Organisation:** blocks are grouped under **Layout** and **Content**.

- Edit a recipient group's name, without deleting it and losing its members. ([#93](https://github.com/jshields-ca/LatestArr/pull/93))
- A **Page not found** screen, with a link back to the dashboard, instead of an empty page. ([#80](https://github.com/jshields-ca/LatestArr/pull/80))

### Improved

- **Newsletters:** ([#83](https://github.com/jshields-ca/LatestArr/pull/83))
  - **Readable schedules:** "Weekly on Monday at 8:00 AM" instead of a cron expression.
  - **Better defaults:** a new newsletter starts in your browser's timezone, with your SMTP profile picked when you only have one.
  - **Grouped fields:** the dialog groups its fields into **Schedule** and **Delivery**.
- **Send history** is easy to scan: one row per send, with a status icon, counts and any error, and failures highlighted in red. It also refreshes straight after **Send now**. ([#83](https://github.com/jshields-ca/LatestArr/pull/83), [#87](https://github.com/jshields-ca/LatestArr/pull/87))
- **Dashboard:** ([#88](https://github.com/jshields-ca/LatestArr/pull/88))
  - **Recent sends:** each shows its newsletter, counts and result.
  - **Checklist:** collapses to "Setup complete" once you're set up.
  - **Stats:** clearer tiles.
  - **Contrast:** status badges meet WCAG AA in both themes.
- **Sources:** each type shows its own logo, and BookLore-family sources explain their OPDS sign-in. ([#91](https://github.com/jshields-ca/LatestArr/pull/91))
- **SMTP:** simpler port and encryption help: 587 is STARTTLS, 465 is implicit TLS, and 25 or 2525 is usually unencrypted. ([#86](https://github.com/jshields-ca/LatestArr/pull/86))
- **Look and feel:**
  - dropdowns match the app's theme instead of showing the browser's own menu ([#85](https://github.com/jshields-ca/LatestArr/pull/85));
  - lists look the same on every page ([#93](https://github.com/jshields-ca/LatestArr/pull/93));
  - the sidebar's project links are a compact card ([#90](https://github.com/jshields-ca/LatestArr/pull/90)).

### Fixed

- **Default layout:** newsletters without a template rendered through an old, imageless layout. They now use the same layout as templates, with posters and details. ([#81](https://github.com/jshields-ca/LatestArr/pull/81))
- **Media List block:** it looked right in the builder, but its section came out empty in sent emails. ([#89](https://github.com/jshields-ca/LatestArr/pull/89))
- **Unfinished templates:** a template saved before it had any design failed the whole send. It now renders as well as it can. ([#92](https://github.com/jshields-ca/LatestArr/pull/92))
- **Send now:** a failure shows a specific error instead of "Internal Server Error", and a send that reached nobody is shown differently from a real send. ([#83](https://github.com/jshields-ca/LatestArr/pull/83))
- **Template builder:** five fixes. ([#84](https://github.com/jshields-ca/LatestArr/pull/84))
  - panel buttons showed as blank squares;
  - the editor used the wrong accent colour;
  - clicking a Media List selected the wrong part of it;
  - **Move up** and **Move down** didn't say when they couldn't move;
  - leaving the page lost unsaved changes without asking.
- **First-run setup** flags a missing name or email, not just a missing password. ([#80](https://github.com/jshields-ca/LatestArr/pull/80))

<details>
<summary>Technical details</summary>

- **Media List:** its exported `<table>` sat directly under `<mj-column>`, which MJML silently drops. It's now wrapped in `<mj-raw>`, with a regression test in `renderMjmlTemplate`.
- **Fragments:** a bare MJML fragment is wrapped in `<mjml><mj-body>` before compiling.
- **Lists:** pages share a `ListRow` component and a `ConfirmDeleteButton`.

</details>

## [0.5.0] - 2026-09-15

### New

- Pick a schedule without cron: **Daily**, **Weekly** or **Monthly**, with a time and a timezone. A raw cron expression is still there under **Advanced**. ([#75](https://github.com/jshields-ca/LatestArr/pull/75))
- Edit a newsletter after creating it: its schedule, lookback window, subject and SMTP profile. Before, changing any of them meant recreating the newsletter. ([#75](https://github.com/jshields-ca/LatestArr/pull/75))

### Improved

- The template builder's Media List block shows posters and details. ([#76](https://github.com/jshields-ca/LatestArr/pull/76))

  - **Details:** runtime, page count, audiobook length, platform and rating.
  - **Content types:** all six (movies, TV episodes, TV seasons, books, audiobooks and games).
  - **Reordering:** every block gets **Move up** and **Move down** buttons, so you don't have to drag.

- Each source type has its own icon on the Sources page, with its proper name ("BookOrbit", not "bookorbit"). ([#77](https://github.com/jshields-ca/LatestArr/pull/77))

## [0.4.6] - 2026-09-15

### New

- Change your own name and password from **Edit profile**, next to your name in the sidebar. Before, neither could be changed without editing the database. Changing your password asks for the current one, and SSO-only accounts are told they have no password to change. ([#73](https://github.com/jshields-ca/LatestArr/pull/73))

## [0.4.5] - 2026-09-15

### Improved

- Tidier project links in the sidebar: a real GitHub logo, a filled star for starring the repo, and an attribution line underneath. The attribution also corrects an earlier draft that called the license AGPL; LatestArr is GPLv3. ([#71](https://github.com/jshields-ca/LatestArr/pull/71))

## [0.4.4] - 2026-09-15

### New

- Edit recipients, SMTP profiles and sources, instead of deleting and recreating them to fix a typo or change a password. ([#69](https://github.com/jshields-ca/LatestArr/pull/69))

  - **Recipients:** their email address can now be changed too, not just their name.
  - **Credentials:** saved passwords, tokens and API keys are never shown. Leave them blank to keep them, or enter new ones to replace them.

  <details>
  <summary>Technical details</summary>

  Adds `PATCH /api/sources/:id`. A source's credentials are replaced only as a complete set for its kind.

  </details>

## [0.4.3] - 2026-09-15

### Fixed

- Sending through port 587 works with providers like DreamHost, instead of failing with an OpenSSL "wrong version number" error. ([#67](https://github.com/jshields-ca/LatestArr/pull/67))

  The TLS switch, now labelled **Use implicit TLS (port 465)**, follows the port you enter unless you change it. Port 587 upgrades to TLS after connecting (STARTTLS), and a failed upgrade is now an error instead of quietly sending unencrypted.

  <details>
  <summary>Technical details</summary>

  The switch defaulted on whatever the port, which made the mailer attempt implicit TLS on a STARTTLS port. The mailer now sets `requireTLS` whenever implicit TLS is off.

  </details>

- The Docker container is always named `latestarr`, whatever folder `docker-compose.yml` is in. Before, a checkout in `test-latestarr/` made a container called `test-latestarr-latestarr-1`. ([#67](https://github.com/jshields-ca/LatestArr/pull/67))

## [0.4.2] - 2026-09-15

### New

- **`TRUST_PROXY=true`** for running behind a reverse proxy that handles HTTPS, so the session cookie is marked secure. ([#65](https://github.com/jshields-ca/LatestArr/pull/65))

### Fixed

- Signing in works when LatestArr is opened over plain HTTP, with no reverse proxy, as in the quick start. Before, sign-in looked like it worked, then immediately showed "Not authenticated". ([#65](https://github.com/jshields-ca/LatestArr/pull/65))

  <details>
  <summary>Technical details</summary>

  The cookie's `Secure` flag followed `NODE_ENV=production`, which the Docker image always sets, so browsers refused the cookie over plain HTTP. It now follows the request's actual protocol, which is only `https` when a trusted proxy says so with `X-Forwarded-Proto`.

  </details>

## [0.4.1] - 2026-09-15

### Fixed

- The web app loads when opened over plain HTTP, with no reverse proxy. Before, it showed a blank page. ([#63](https://github.com/jshields-ca/LatestArr/pull/63))

  <details>
  <summary>Technical details</summary>

  The default Content Security Policy from `@fastify/helmet` includes `upgrade-insecure-requests`, so browsers rewrote every script and stylesheet request to `https://`, which LatestArr doesn't serve. The directive is now removed.

  </details>

## [0.4.0] - 2026-09-15

### New

- A published container image, `ghcr.io/jshields-ca/latestarr`, for every release (`:latest` and `:vX.Y.Z`), so you can `docker compose pull` instead of building from source. ([#62](https://github.com/jshields-ca/LatestArr/pull/62))
- Missed sends catch up. If LatestArr was down when a newsletter was due, it sends once when it starts again. Before, that issue was silently skipped. ([#58](https://github.com/jshields-ca/LatestArr/pull/58))
- The running version shows in the sidebar, with links to the project on GitHub. **`PORT`** sets the host port, for when 3000 is taken. ([#61](https://github.com/jshields-ca/LatestArr/pull/61))

### Improved

- Security for internet-facing installs: security headers and a Content Security Policy, a sign-in limit of 10 attempts a minute, and protection against cross-site requests. ([#55](https://github.com/jshields-ca/LatestArr/pull/55))
- Every request is checked before it's used, so malformed input is refused with a clear error instead of reaching the database. ([#57](https://github.com/jshields-ca/LatestArr/pull/57))
- The template builder works by keyboard. Its panels and blocks can be reached with Tab and used with Enter or Space, and blocks can be added without dragging. ([#59](https://github.com/jshields-ca/LatestArr/pull/59))

<details>
<summary>Technical details</summary>

- **Security:** `@fastify/helmet` with a CSP tuned for the builder and Google Fonts; `@fastify/rate-limit` with a generous global default and 10 a minute on sign-in and first-run setup; a same-origin check on every request that changes something.
- **Validation:** zod schemas for every request body, returning 400 for wrong types.
- **Catch-up:** on start, each enabled newsletter's last send (or creation time) is compared with its schedule.
- **Version:** `GET /api/version`, which needs no sign-in.

</details>

## [0.3.0] - 2026-09-14

### New

- The dashboard is a setup checklist: connect a source, add recipients and a group, set up SMTP, optionally build a template, and create a newsletter. Once you're set up, it shows live stats and recent sends. ([#53](https://github.com/jshields-ca/LatestArr/pull/53))
- A `docker-compose.yml` and `.env.example` for a quick start, instead of a bare Dockerfile. ([#53](https://github.com/jshields-ca/LatestArr/pull/53))

## [0.2.0] - 2026-09-14

### New

- **A web app for LatestArr.** Before, everything was done through its API. ([#18](https://github.com/jshields-ca/LatestArr/pull/18), [#19](https://github.com/jshields-ca/LatestArr/pull/19), [#24](https://github.com/jshields-ca/LatestArr/pull/24))

  - **Sign-in:** a first-run setup screen to create the admin account, and a sign-in page with **Continue with SSO** when OIDC is set up.
  - **Layout:** a sidebar on desktop and a menu on phones, in dark or light mode.
  - **One container:** the Docker image serves the web app and the API together.

- **Pages for everything,** each wired to the existing API:
  - **Sources:** connect, test and delete sources, with the right credential fields for each type. ([#20](https://github.com/jshields-ca/LatestArr/pull/20), [#36](https://github.com/jshields-ca/LatestArr/pull/36))
  - **Recipients:** add people, switch them on or off, and manage groups. ([#21](https://github.com/jshields-ca/LatestArr/pull/21))
  - **SMTP Profiles:** add a profile, test the connection, and send a test email. ([#22](https://github.com/jshields-ca/LatestArr/pull/22))
  - **Newsletters:** create, enable, link sources and groups, **Send now**, and view send history. ([#23](https://github.com/jshields-ca/LatestArr/pull/23))

- **Four more sources:**
  - **Plex**, directly, without Tautulli ([#32](https://github.com/jshields-ca/LatestArr/pull/32));
  - **BookLore, BookOrbit and Grimmory**, through their OPDS catalogs ([#33](https://github.com/jshields-ca/LatestArr/pull/33));
  - **Audiobookshelf** ([#34](https://github.com/jshields-ca/LatestArr/pull/34));
  - **RomM** ([#35](https://github.com/jshields-ca/LatestArr/pull/35)).

- **Templates and a drag-and-drop builder** for designing newsletters. ([#25](https://github.com/jshields-ca/LatestArr/pull/25), [#27](https://github.com/jshields-ca/LatestArr/pull/27), [#28](https://github.com/jshields-ca/LatestArr/pull/28), [#29](https://github.com/jshields-ca/LatestArr/pull/29), [#30](https://github.com/jshields-ca/LatestArr/pull/30))

  - **The Media List block** fills itself from your sources: choose a content type, a sort and a count.
  - **Most watched:** a sort option, from Tautulli's play counts. ([#26](https://github.com/jshields-ca/LatestArr/pull/26))
  - **Email-ready:** templates are built into email-safe HTML that works in Outlook and Gmail.

  Each newsletter picks a template, or uses the built-in one. (The builder was later replaced by the design editor.)

### Improved

- **A new look, "Bloom":** ([#37](https://github.com/jshields-ca/LatestArr/pull/37))
  - **Colour:** a rose accent, chosen to stand apart from the blues and purples common in self-hosted media apps;
  - **Light mode:** warmer neutrals;
  - **Logo:** an envelope with a spark;
  - **Wordmark:** a serif.
- **Accessibility checks** on every page of the web app, which found and fixed a heading-order problem across the app. ([#31](https://github.com/jshields-ca/LatestArr/pull/31))

<details>
<summary>Technical details</summary>

- **Web app:** Tailwind v4 with Radix components. Every API route moved under `/api`, so page and API paths can't collide.
- **Sources:** `GET /sources/kinds` lists the registered source types.
- **Adapters:**
  - the BookLore-family adapter is one factory for all three apps, since they share the same OPDS feed;
  - Audiobookshelf has no cross-library "recent" endpoint, so it reads each library;
  - RomM filters by platform in one request.
- **Templates:** the Template API stores the builder's design JSON and compiled MJML. Newsletters render through MJML and Handlebars, with the hardcoded starter template as the fallback.
- **Accessibility:** `jest-axe` tests cover every page's list, empty and dialog states. `CardTitle` became an `<h2>`.

</details>

<details>
<summary>Behind the scenes</summary>

- **Release automation:** a "Version Packages" PR, and a tag and GitHub Release on merge. ([#38](https://github.com/jshields-ca/LatestArr/pull/38))
- **Versioning fix:** Changesets had been skipping every private package. ([#38](https://github.com/jshields-ca/LatestArr/pull/38))
- **First-run fixes:** two crashes on the release workflow's first run. ([#42](https://github.com/jshields-ca/LatestArr/pull/42), [#43](https://github.com/jshields-ca/LatestArr/pull/43))

</details>

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
