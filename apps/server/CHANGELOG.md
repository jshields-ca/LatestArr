# @latestarr/server

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

- [#312](https://github.com/jshields-ca/LatestArr/pull/312) [`6071248`](https://github.com/jshields-ca/LatestArr/commit/6071248f228f5fd5764568327327d779d43117ee) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** More branding options for designs, under **Branding** in the design editor.

  - **More colours:** choose your own colours for type labels (text and background), for buttons (colour and text), and for links in the intro and footer note. Each follows the accent until you set it, and **Use accent** puts it back, so existing designs, Default included, look exactly as before. Custom label and link colours get dark-mode versions too.
  - **Button style:** rounded, square or pill shape; filled or outlined; regular or small. "Where to watch" buttons share the shape and size.
  - **Contrast check:** the editor warns when a colour pair would be hard to read (below WCAG AA, 4.5:1). It doesn't stop you saving.

  <details>
  <summary>Technical details</summary>
  - Closes [#293](https://github.com/jshields-ca/LatestArr/issues/293).
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

- [#315](https://github.com/jshields-ca/LatestArr/pull/315) [`9253e16`](https://github.com/jshields-ca/LatestArr/commit/9253e16484b59d1cf9dbf305ec399812d94018b0) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** Add your logo to the top of a design, under **Logo** in the design editor.

  - **Upload** a PNG, JPEG or GIF (up to 1 MB). It's included in each email, so it shows even where email apps block images from the web. Or use an **image URL**, either copied into each email (the default) or linked.
  - **Link it** to your server's site, Overseerr, or your Plex or Jellyfin app.
  - Put it **above the newsletter's name or in place of it**, aligned left, centre or right, at the width you choose. It shrinks to fit on phones.
  - Add a **dark mode version** for logos with dark lettering, which would otherwise disappear on dark backgrounds. Switch the preview to Dark to check it.
  - Code designs can place it themselves with `{{logo}}`.

  <details>
  <summary>Technical details</summary>
  - Closes [#302](https://github.com/jshields-ca/LatestArr/issues/302).
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

- [#311](https://github.com/jshields-ca/LatestArr/pull/311) [`2072152`](https://github.com/jshields-ca/LatestArr/commit/207215221cc56ac3a5e379fd87d990ace7328c02) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** A design's **Intro** and **Footer note** support simple formatting and alignment.

  - **Formatting:** **bold**, _italic_, ~~strikethrough~~, `[links](https://example.com)` (in the design's accent colour), and bulleted or numbered lists.
  - **Alignment:** each note can be left, centre or right aligned.
  - **What stays the same:** existing notes look as they did, and HTML typed into a note still shows as text. One thing to check: a `*` or `_` around words, or a line starting with `-` or `1.`, now formats.

  <details>
  <summary>Technical details</summary>
  - Closes [#290](https://github.com/jshields-ca/LatestArr/issues/290).
  - New `render/notes.ts`, using [markdown-it](https://github.com/markdown-it/markdown-it) 15 (a new server dependency) from its `zero` preset.
    - Enabled: lists, newline (`breaks: true`), emphasis, strikethrough, link, escape, entity. `html: false`.
    - `validateLink` allows only `http`, `https` and `mailto`.
    - Paragraphs, lists and links get inline styles, since email clients ignore most stylesheets. Lists are `inline-block` so they follow the note's alignment.
    - A single paragraph renders unwrapped, so the existing snapshot is unchanged. The last block's bottom gap is dropped.
  - `{{introText}}` and `{{footerNote}}` now render this Markdown in code-mode designs too, replacing [#289](https://github.com/jshields-ca/LatestArr/issues/289)'s line-break helper. Links use `noteLinkColor`, the design's accent, which `designContentVariables` passes along.
  - New settings `content.introAlign` and `content.footerAlign` (`left`, `center` or `right`; default `left`) become `mj-text align`.
  - Editor: a `NoteField` with an alignment picker in design mode and a formatting hint.

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

- [#309](https://github.com/jshields-ca/LatestArr/pull/309) [`64196a9`](https://github.com/jshields-ca/LatestArr/commit/64196a9e6e8fe286cafd45a9a3b631f55de2ab60) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** **Send to the rest** finishes a newsletter that only reached some of its recipients, without sending anyone a duplicate. Use it when LatestArr stopped partway, the mail server turned some people away, or a rate limit cut a send off. Open the send's **Details** in the newsletter's **History** and choose **Send to the rest**. It sends the same email, with the same items, subject and images, to only the people who didn't get it, including anyone whose delivery failed. A confirmation shows who it will go to, and their results are added to the same send. It works on the newsletter's latest send, within its lookback window, and is for editors and admins.

  <details>
  <summary>Technical details</summary>
  - Closes [#283](https://github.com/jshields-ca/LatestArr/issues/283).
  - **Migration `0010_send_to_the_rest`:**
    - `send_runs.subject`, set with `rendered_html`;
    - `send_runs.rest_sent_at`;
    - a new `send_run_attachments` table holding a send's embedded images (cid, filename, type, bytes). A newsletter's earlier sends' images are deleted when its next send renders, so storage stays at one send per newsletter.
  - **New `pipeline/send-to-the-rest.ts`:**
    - `planSendToTheRest()` checks that the send is `partial_failure` or `failed` and has its stored subject, HTML and every referenced image.
    - It also checks that it's the newsletter's latest send (no later send, by insertion order, reached anyone) and that it started within `lookbackDays`.
    - It returns the newsletter's active recipients not recorded as `sent`.
    - `sendToTheRest()` claims the run by setting it to `running` in one conditional `UPDATE`, which shares Send now's "already running" lock and stops two requests from both sending. It then sends, replaces each recipient's earlier result, and sets the final status, `finishedAt` and `restSentAt`, in a `finally` block.
    - If LatestArr stops partway, the startup clean-up from [#280](https://github.com/jshields-ca/LatestArr/issues/280) closes the send as usual.
  - **API:**
    - `GET /newsletters/:id/send-runs/:runId/rest` (editor) returns the plan, or why the send can't be finished.
    - `POST /newsletters/:id/send-runs/:runId/send-to-rest` (editor) answers 409 when the send can't be finished or another send is running.
    - The History list adds `canSendToRest` and `restSentAt`, and breaks ties on start time by insertion order.
  - **Web:** a `SendToRestDialog` in the send's details, and "Sent to the rest" with its time in History.
  - **Docs:** `self-hosting.md` covers finishing a partly sent newsletter. The interrupted-send message and alert now point to **Send to the rest**.

  </details>

- [#274](https://github.com/jshields-ca/LatestArr/pull/274) [`559eda9`](https://github.com/jshields-ca/LatestArr/commit/559eda95d74ed5c84ce08982722a565bf45a87e9) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** Users can now be admins, editors, or viewers. Viewers see newsletters, designs, previews, and send history without being able to change anything. Editors can also create and send newsletters, edit designs, and manage recipients. Admins can do everything, including sources, SMTP, notifications, users, and logs. Choose a role when you add someone, or change it from the Users page. Existing users stay admins.

  <details>
  <summary>Technical details</summary>
  - Closes [#257](https://github.com/jshields-ca/LatestArr/issues/257). Roles are enforced on the server: `requireAuth(db, { read, write })` gives each route group the role it needs for `GET` and for changes, and a route can ask for a different one with `config: { minRole }` (previews are open to viewers; `GET /sources/:id/libraries` and `/users`, recipient lists, and a send's recipient results need an editor).
  - A refused request answers `403` with `code: "role_required"` and the role needed, and is logged.
  - `security.test.ts` lists every signed-in route with the role it needs, fails when a new route isn't listed, and checks each route against all three roles.
  - `POST /users` takes a `role` (default `viewer`) and `PATCH /users/:id` can change it. Admins can't change their own role, and the last active admin can't be demoted, deactivated, or deleted. Role changes apply on the next request.
  - The web app hides the pages and controls a role can't use: the sidebar is filtered, admin-only pages show a "No access" card, newsletters and designs are read-only for viewers (a disabled `fieldset`, and a read-only code editor), and pages only fetch what the role can read.
  - The SMTP Profiles page is admin-only; editors still get the profile list for choosing one on a newsletter.

  </details>

### Patch Changes

- [#308](https://github.com/jshields-ca/LatestArr/pull/308) [`43bec4e`](https://github.com/jshields-ca/LatestArr/commit/43bec4ed5f2fa93e83a7759bccf3a9a67e1f7ac1) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** BookOrbit's new logo now shows on the Sources page.

  <details>
  <summary>Technical details</summary>
  - Closes [#296](https://github.com/jshields-ca/LatestArr/issues/296).
  - `assets/logos/bookorbit.svg` is replaced by `bookorbit.webp` (243×243, 16 KB), BookOrbit's new logo from selfh.st/icons. Upstream removed the SVG on 2026-10-05 and now publishes this logo only as PNG and WebP.
  - `NOTICE.md` has been updated: the file, its source path, and the project link (`bookorbit.app`).
  - The name stays "BookOrbit", one word, as the project writes it. The sample-preview button added in this release says "Read on BookOrbit".

  </details>

- [#314](https://github.com/jshields-ca/LatestArr/pull/314) [`983ba35`](https://github.com/jshields-ca/LatestArr/commit/983ba359973408cfcb916fff09d9ed7d3134c71f) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** Updated Handlebars, the template engine behind newsletter and design templates, to pick up upstream security fixes.

  <details>
  <summary>Technical details</summary>
  - `handlebars` 4.7.9 → 4.7.10, and the server's range raised to `^4.7.10` so older versions can't be resolved.
  - Fixes three JavaScript-injection advisories (Dependabot alerts [#71](https://github.com/jshields-ca/LatestArr/issues/71), [#72](https://github.com/jshields-ca/LatestArr/issues/72) and [#73](https://github.com/jshields-ca/LatestArr/issues/73)): an own-property check bypass, AST type confusion in `compile`, and unsafe inline embedding of precompiled templates.

  </details>

- [#313](https://github.com/jshields-ca/LatestArr/pull/313) [`01e1b96`](https://github.com/jshields-ca/LatestArr/commit/01e1b9643e9b305c1b2172d685eae52c3ceba01b) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** Updated two bundled libraries to pick up upstream security fixes.

  <details>
  <summary>Technical details</summary>
  - Lockfile-only bump of two transitive dependencies:
    - `source-map-js` 1.2.1 → 1.2.2 (event-loop denial of service via indexed source-map offsets; reached through mjml and Tailwind);
    - `shell-quote` 1.10.0 → 1.12.0 (command injection in `quote()`; reached only through `@changesets/cli`, a dev tool).
  - Clears Dependabot alerts [#69](https://github.com/jshields-ca/LatestArr/issues/69) and [#70](https://github.com/jshields-ca/LatestArr/issues/70).

  </details>

- [#307](https://github.com/jshields-ca/LatestArr/pull/307) [`4420f7b`](https://github.com/jshields-ca/LatestArr/commit/4420f7bb0721208cebccca9682de9a0adea2832e) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** When a design is set to **Link to the library** for sections with nothing new, the section now shows "Nothing new this time." and a **Browse audiobooks** button styled like the design's other buttons, in its accent colour and in dark mode. Before, it was a bare link that didn't match the design. If the section already ends with its own "Watch on Plex"-style button, the browse button is left out so the same link doesn't appear twice.

  <details>
  <summary>Technical details</summary>
  - Fixes [#292](https://github.com/jshields-ca/LatestArr/issues/292).
  - New Handlebars helper `{{#libraryLinkFor contentType="…" label="…"}}`, which renders its block with `{label, url}` from the linked sources' library address. The else block runs when there's no library address.
  - Built-in designs no longer use `mediaList`'s `emptyFallback="link"`. They render `emptyMessage` plus the secondary `button()` inside `ifAnyItems`'s else block, wrapped in `sourceButtonsFor`'s else block when source buttons are placed per section.
  - `mediaList`'s `emptyFallback="link"` is unchanged for code-mode designs. It now shares the `libraryLink()` lookup.

  </details>

- [#282](https://github.com/jshields-ca/LatestArr/pull/282) [`5a8cab1`](https://github.com/jshields-ca/LatestArr/commit/5a8cab192b527d8b5b72ef1164161b18d351d26f) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** If LatestArr stopped partway through sending a newsletter (a crash, restart, or upgrade), that newsletter could never send again: every later send said one was "already running". Now, when LatestArr starts, it closes the interrupted send, marks it partly sent or failed, shows who got it in History, and alerts you. Nobody who already got it is sent a duplicate.

  <details>
  <summary>Technical details</summary>
  - Fixes [#280](https://github.com/jshields-ca/LatestArr/issues/280).
  - New `closeInterruptedSends()` (`pipeline/interrupted-sends.ts`), run by `startScheduler` before refreshing jobs and before catch-up.
    - Each run still `running` becomes `partial_failure`, or `failed` if no recipient was recorded as sent.
    - It sets `finishedAt` and an error that says how many of how many recipients were reached, then logs a warning and sends a failure alert (trigger `interrupted`).
  - Nothing is resent automatically. The interrupted run keeps its `startedAt`, so missed-send catch-up treats that period as sent.
  - A send now records its item and recipient counts before the send loop rather than at the end, so an interrupted send can report "X of Y".
  - Known limit: a recipient whose message the SMTP server accepted in the instant before the stop, but which wasn't yet recorded, shows as not sent.

  </details>

- [#305](https://github.com/jshields-ca/LatestArr/pull/305) [`342d273`](https://github.com/jshields-ca/LatestArr/commit/342d273bd18996e1ab4814cbc696a040174b9c73) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** Line breaks in a design's **Intro** and **Footer note** now show in the preview and in sent emails. Before, every line ran together into one paragraph. A blank line leaves a gap between paragraphs.

  <details>
  <summary>Technical details</summary>
  - Fixes [#289](https://github.com/jshields-ca/LatestArr/issues/289).
  - New `textWithLineBreaks()` in `render/mjml-template.ts` escapes each line and joins them with `<br>`. One or more blank lines become a single `<br><br>`.
  - `{{introText}}` and `{{footerNote}}` are now bound as a Handlebars `SafeString`, so code-mode designs get the line breaks too. The text is still escaped, so HTML typed into either box shows as text.
  - The plain-text version keeps the breaks, since `<br>` converts to a newline.

  </details>

- [#306](https://github.com/jshields-ca/LatestArr/pull/306) [`ae31270`](https://github.com/jshields-ca/LatestArr/commit/ae3127054e7677b9bf181d9359da186e3dc2c6d3) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** In a design's preview with sample content, the source buttons now match your connected sources, for example "Read on BookOrbit" for a BookOrbit source. Before, the sample always said "Read on BookLore". With no sources connected yet, it shows neutral labels such as "Watch now" and "Read now".

  <details>
  <summary>Technical details</summary>
  - Fixes [#291](https://github.com/jshields-ca/LatestArr/issues/291).
  - `/templates/preview` loads the source connections (kind, name, public URL) and passes them to `renderDesignSample`.
  - `sampleSourceButtons()` builds the buttons with `buildSourceButtons`, so labels, merging and naming match a real send. A source without a public URL gets a stand-in URL so its button still shows in the sample.

  </details>

- [#279](https://github.com/jshields-ca/LatestArr/pull/279) [`70dda5f`](https://github.com/jshields-ca/LatestArr/commit/70dda5f6ed52a9d5d09d34465677776e87646a6e) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** Updated two third-party libraries with published security fixes, so LatestArr isn't exposed to their denial-of-service and address-matching bugs.

  <details>
  <summary>Technical details</summary>
  - `ip-address` 10.7.0 → 10.7.3 (via `@fastify/rate-limit`, so it ships in the server): fixes an unbounded parse diagnostic on long input that could stall the process, and `isInSubnet()` comparing IPv4 and IPv6 addresses as one address space.
  - `brace-expansion` 1.1.18 → 1.1.21 and 5.0.9 → 5.0.12 (via `minimatch`, build and lint tooling): fixes stack exhaustion on nested or comma-heavy brace patterns and quadratic-time expansion.
  - Lockfile-only change (`pnpm update --depth Infinity`), within each parent's allowed range. Clears Dependabot alerts [#61](https://github.com/jshields-ca/LatestArr/issues/61)–[#68](https://github.com/jshields-ca/LatestArr/issues/68).

  </details>

- [#301](https://github.com/jshields-ca/LatestArr/pull/301) [`85e9a55`](https://github.com/jshields-ca/LatestArr/commit/85e9a557399feaa32fca6d5fc06cb63b2eb00a7a) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** A design with a **Most watched** section couldn't preview or send for newsletters using a Tautulli source. They failed with "Send failed: data.find is not a function". Most watched now shows Tautulli's most played movies and shows again.

  <details>
  <summary>Technical details</summary>
  - Fixes [#284](https://github.com/jshields-ca/LatestArr/issues/284).
  - With a `stat_id`, Tautulli's `get_home_stats` returns that one stat block as an object, or `[]` when there are no stats. `getHomeStats` expected an array of blocks, so `.find` threw.
  - It now accepts the single block, still searches an array by `stat_id`, and returns `[]` for an empty result.
  - Any other shape (null, a different stat, `rows` that isn't a list) throws a clear "unexpected response" error instead of a `TypeError`.
  - Client, adapter and send-route tests now use Tautulli's real response shape, with tests for the array and unexpected cases.

  </details>

- Updated dependencies [[`31615b2`](https://github.com/jshields-ca/LatestArr/commit/31615b2d20e5c5fc3c1e0a1dd315ca2ba8bade4b), [`9253e16`](https://github.com/jshields-ca/LatestArr/commit/9253e16484b59d1cf9dbf305ec399812d94018b0), [`e071447`](https://github.com/jshields-ca/LatestArr/commit/e0714475552f1f690bcaf8b267b4b7ae0a0a1c11), [`64196a9`](https://github.com/jshields-ca/LatestArr/commit/64196a9e6e8fe286cafd45a9a3b631f55de2ab60), [`85e9a55`](https://github.com/jshields-ca/LatestArr/commit/85e9a557399feaa32fca6d5fc06cb63b2eb00a7a)]:
  - @latestarr/db@0.12.0
  - @latestarr/adapter-tautulli@0.12.0
  - @latestarr/adapter-audiobookshelf@0.12.0
  - @latestarr/adapter-booklore-family@0.12.0
  - @latestarr/adapter-core@0.12.0
  - @latestarr/adapter-jellyfin@0.12.0
  - @latestarr/adapter-plex@0.12.0
  - @latestarr/adapter-romm@0.12.0
  - @latestarr/crypto@0.12.0

## 0.11.2

### Patch Changes

- Updated dependencies []:
  - @latestarr/adapter-audiobookshelf@0.11.2
  - @latestarr/adapter-booklore-family@0.11.2
  - @latestarr/adapter-core@0.11.2
  - @latestarr/adapter-jellyfin@0.11.2
  - @latestarr/adapter-plex@0.11.2
  - @latestarr/adapter-romm@0.11.2
  - @latestarr/adapter-tautulli@0.11.2
  - @latestarr/crypto@0.11.2
  - @latestarr/db@0.11.2

## 0.11.1

### Patch Changes

- [#259](https://github.com/jshields-ca/LatestArr/pull/259) [`6af4e0c`](https://github.com/jshields-ca/LatestArr/commit/6af4e0c4f0b5090d76cd6ef52215c8b57c5405fa) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** LatestArr now checks `ENCRYPTION_KEY` when it starts. If the key is missing or invalid, it stops with a message saying how to generate one. Before, it started anyway, and saving a source or SMTP profile failed with a generic error.

  <details>
  <summary>Technical details</summary>
  - `encryptionKeyProblem()` (`apps/server/src/secrets.ts`) requires `ENCRYPTION_KEY` to be base64 that decodes to exactly 32 bytes. `index.ts` logs the problem at `fatal` and exits 1 before touching the database.
  - The wrong-length message warns that credentials already saved need the key they were saved with. ([#256](https://github.com/jshields-ca/LatestArr/issues/256))
  - The CI smoke test now starts the container with a generated key, and `CONTRIBUTING.md` describes the new startup error for dev setups where Turborepo's strict env mode drops the key.

  </details>

- [#258](https://github.com/jshields-ca/LatestArr/pull/258) [`fa938dd`](https://github.com/jshields-ca/LatestArr/commit/fa938dd481afcfd061801147bd83be10336d9b90) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** LatestArr now points to its new home at [latestarr.app](https://www.latestarr.app). The web UI footer links the website, the docs, GitHub Discussions, issue reporting and the license, and credits LatestArr's contributors, as the site does. The Add source dialog links each source type's setup guide, and the Default design's email footer links LatestArr.app instead of GitHub.

  <details>
  <summary>Technical details</summary>
  - **Web UI footer:** the links (LatestArr.app, Docs, Discussions, Report an issue, GPLv3 license) sit in a labelled `nav`, with "© 2026 LatestArr contributors · Led by Jeremy Shields" beneath, linking jeremyshields.ca. The old scootr.ca author link is gone. ([#251](https://github.com/jshields-ca/LatestArr/issues/251))
  - **Add source dialog:** a "Setup guide for …" link to that type's page under `latestarr.app/docs/sources`. Plex, BookLore, Grimmory and Audiobookshelf now show the testers note too, linking [#244](https://github.com/jshields-ca/LatestArr/issues/244), to match the README; Jellyfin and Emby still link [#196](https://github.com/jshields-ca/LatestArr/issues/196).
  - **Code mode:** the variables reference links the code mode guide.
  - **Email footer:** the Default design links `https://www.latestarr.app` (with a globe icon) in place of the repository, and keeps "Report an issue". ([#252](https://github.com/jshields-ca/LatestArr/issues/252))
  - **Footer icons fixed:** the email footer icons were never visible. Their SVG stroke colour was written `%23978490` inside base64, where it isn't URL-decoded, so it was an invalid colour. They now use a literal `[#978490](https://github.com/jshields-ca/LatestArr/issues/978490)`.
  - The default design snapshots were re-recorded for the footer change.

  </details>

- Updated dependencies []:
  - @latestarr/adapter-audiobookshelf@0.11.1
  - @latestarr/adapter-booklore-family@0.11.1
  - @latestarr/adapter-core@0.11.1
  - @latestarr/adapter-jellyfin@0.11.1
  - @latestarr/adapter-plex@0.11.1
  - @latestarr/adapter-romm@0.11.1
  - @latestarr/adapter-tautulli@0.11.1
  - @latestarr/crypto@0.11.1
  - @latestarr/db@0.11.1

## 0.11.0

### Minor Changes

- [#177](https://github.com/jshields-ca/LatestArr/pull/177) [`c3e828a`](https://github.com/jshields-ca/LatestArr/commit/c3e828ab7fa5ea7d25111ea1f590033af6895e60) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** The Logs page now records what's actually happening: every newsletter send and how many people it reached, recipients that couldn't be delivered to, sources that couldn't be reached, sign-ins and failed sign-in attempts, and each settings change along with who made it. A new `LOG_LEVEL` setting controls how much detail is kept.

  <details>
  <summary>Technical details</summary>

  Closes [#168](https://github.com/jshields-ca/LatestArr/issues/168). Previously the server had three explicit log calls in total, so the Logs page only ever showed startup lines.

  - **Shared logger** (`apps/server/src/logger.ts`): one pino instance for Fastify, the send pipeline, and the scheduler, so scheduled sends (which have no request) reach the Logs page too. `LOG_LEVEL` (default `info`) is read from the environment and passed through `docker-compose.yml`; an unknown value falls back to `info` with a warning instead of crashing on startup.
  - **Who did it**: `requireAuth` swaps `request.log` for a child logger carrying `user` (the signed-in admin's email), so every line from an authenticated route records the actor.
  - **Sends** (`pipeline/run-newsletter.ts`): `runNewsletter` takes `{ trigger, log }` and logs every outcome exactly once — start, success/partial/total failure with counts and duration, each undeliverable recipient (warn), the specific source that couldn't be fetched (warn), a send with no active recipients or no usable sources (warn), and a refused send (not found / misconfigured / already running) as a warn rather than an error. The send-now route and scheduler no longer log send failures themselves.
  - **Scheduler**: each refresh logs one line listing every enabled newsletter's next run; startup catch-ups are logged and tagged `trigger: "catch-up"`, cron fires `"scheduled"`, and send-now `"manual"`.
  - **Settings changes**: create/update/delete for sources, SMTP profiles, recipients (plus a one-line import summary), groups and memberships, newsletters (with "Enabled"/"Paused" for the toggle and a `fields` list of what changed), templates, and newsletter source/group links. Connection and test-email results for sources and SMTP profiles. Sign-in, failed sign-in (with IP), sign-out, SSO sign-in/rejection, first-admin creation, and password/profile changes.
  - Field names are logged for updates, never values, so passwords and API keys can't leak into logs. Tests assert log levels, the `user`/`trigger` fields, and that a password never appears in the buffer.

  </details>

- [#209](https://github.com/jshields-ca/LatestArr/pull/209) [`4b4d29d`](https://github.com/jshields-ca/LatestArr/commit/4b4d29de22120b1be2569f9a3a34eca2c4b5d3e8) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** Designs can be edited as code. On any design, **Edit as code** switches it to hand-written MJML. You start from exactly the markup its options produce, so you never start from a blank page. The code editor highlights Handlebars tags, flags mistakes on the line where they happen before you save, and sits beside the same live preview. A **Variables and helpers** panel lists everything you can use. The intro, footer note, and buttons stay in **Text and buttons**, so they work the same in code designs.

  <details>
  <summary>Technical details</summary>

  Closes [#200](https://github.com/jshields-ca/LatestArr/issues/200) (part of [#199](https://github.com/jshields-ca/LatestArr/issues/199)).

  - Editor: CodeMirror 6 (`components/code-editor.tsx`, loaded on demand in its own chunk), with HTML highlighting coloured from the app's theme tokens, Handlebars tags marked, and server-reported issues as lint diagnostics. `components/design-code-reference.tsx` documents the render context and the `mediaList`, `ifAnyItems`, and `ifKindLinked` helpers.
  - Server: `render/code-template.ts` checks code before preview and save. A Handlebars syntax error, or markup MJML can't render at all, is an error (422, with `issues`), shown in plain words with its line. MJML's own validation messages are warnings, since sends still render best-effort HTML. MJML is validated with the `{{ }}` tags blanked out, so line numbers still match.
  - `POST /templates/preview` accepts `mjml` alongside `settings`. `POST /templates/:id/convert-to-code` switches a design to code. `POST`/`PATCH /templates` take an explicit `mode`, and saving a code design with its `settings` no longer turns it back into an options design.
  - Designs list: code designs sit with the others (marked "Code") and duplicate with their code.
  - The built-in design's buttons no longer set `width="auto"`, which MJML flags as invalid. The rendered email looks the same, since the button's table already shrinks to fit.

  </details>

- [#224](https://github.com/jshields-ca/LatestArr/pull/224) [`e68624a`](https://github.com/jshields-ca/LatestArr/commit/e68624a7c725c403dbf7d397a3dd2a3004e5383d) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** Newsletters look right in dark-mode email apps. Emails now say they support light and dark mode, and include dark versions of the design's own colours, so apps like Apple Mail and Outlook.com use those instead of guessing. Type badges have a thin outline, so they stay visible in apps that remove backgrounds (such as Thunderbird's dark message view).

  <details>
  <summary>Technical details</summary>

  Closes [#216](https://github.com/jshields-ca/LatestArr/issues/216).

  - Designs declare `color-scheme: light dark` (meta tags and `:root`) and always set an explicit body background.
  - For a light design, dark colours are derived from its palette. `@media (prefers-color-scheme: dark)` rules, plus `[data-ogsc]`/`[data-ogsb]` rules for Outlook.com, swap each inline colour by value (e.g. `[style*="color:[#241521](https://github.com/jshields-ca/LatestArr/issues/241521)"]`), so no element needs its own class and custom palettes work too. Palette colours are lower-cased so the selectors match. A design that's already dark only declares support.
  - Badges get a 1px border mixed from the accent colour. The Default design's snapshot changes accordingly.
  - Gmail's apps apply their own dark mode and ignore these styles, so results there vary.

  </details>

- [#226](https://github.com/jshields-ca/LatestArr/pull/226) [`8df22e9`](https://github.com/jshields-ca/LatestArr/commit/8df22e95c8ce542153f0c817011acd4727254632) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** The Default design has a fresh look to match the LatestArr app. The newsletter sits on a white card with an accent bar, and the header shows the date range, how many items are new, and a count for each type. Items are grouped into Movies, TV, Books, and so on, with smaller posters, tidier spacing, and summaries trimmed to about two lines.

  **New:** Several new episodes of the same show now share one row, like "The Daily Show · 4 new episodes", with each episode listed underneath, so a week of a daily show doesn't fill the email. It's on by default, and you can switch it off in a design's Sections settings. Designs you saved earlier keep their "Group by type" setting; turn it on in the design editor to get the new sections.

  <details>
  <summary>Technical details</summary>

  Closes [#218](https://github.com/jshields-ca/LatestArr/issues/218) and [#219](https://github.com/jshields-ca/LatestArr/issues/219).

  - `render/design.ts`: the email is an `mj-wrapper` card with a 4px accent top border on a tinted page (`page` colour, with its own dark-mode rule), with the credits below the card. Cards rows have a 72px poster and hairline dividers, `overviewShort`, and a pill badge. `groupByType` now defaults to true, and TV episodes and seasons share one "TV" section (`contentType="tv_episode,tv_season"`). New option `sections.groupEpisodes` (default true).
  - `render/mjml-template.ts`: `mediaList` takes `groupEpisodes="true"` and comma-separated `contentType`. `ifAnyItems` and `ifKindLinked` accept several types, and `ifKindLinked` is also true when a type has items, so a section never hides real items. New context values: `periodFormatted`, `itemCount`, `kindCounts`, `hasLinkedSources`, and per item `overviewShort`, `episodes`, `episodeCount`, `moreEpisodes`. The code-mode reference documents them.
  - An issue with nothing new and no linked sources says "No new items in this period." instead of rendering nothing.
  - Design editor: a "Group a show's new episodes" switch; the section order lists Movies, TV, Books, Audiobooks, Games and moves TV's two types together; the "lookback line" option is now "Show the date range and counts". The sample preview includes two episodes of one show.
  - Default snapshots re-recorded.

  </details>

- [#212](https://github.com/jshields-ca/LatestArr/pull/212) [`71d9e58`](https://github.com/jshields-ca/LatestArr/commit/71d9e58eb57d96e4343d63f64bf23afea01f4b6f) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** Deleting a design that a newsletter uses no longer fails with an error. Those newsletters switch back to the Default design, and the Designs page now shows which newsletters use each design and says so before you confirm.

  <details>
  <summary>Technical details</summary>

  `DELETE /templates/:id` failed with `SQLITE_CONSTRAINT_FOREIGNKEY` whenever a newsletter referenced the design. It now clears those newsletters' `templateId` and deletes the design in one transaction, logging which newsletters changed. `ConfirmDeleteButton` takes an optional `prompt`.

  </details>

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

- [#211](https://github.com/jshields-ca/LatestArr/pull/211) [`e367342`](https://github.com/jshields-ca/LatestArr/commit/e367342bb3c1d3bc3c1c5232a71bfc5c7e15bb5e) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** Jellyfin and Emby sources, for movies, TV episodes, books, and audiobooks. Add one with an API key. Newsletters show each item's poster, details, and a link that opens it in your server's web app, and you can import the server's users as recipients. **These need testers:** they're built from the published API docs but haven't been tried on a real server yet. If you run Jellyfin or Emby, please [tell us how it went](https://github.com/jshields-ca/LatestArr/issues/196).

  <details>
  <summary>Technical details</summary>

  Part of [#196](https://github.com/jshields-ca/LatestArr/issues/196) (the issue stays open until both are confirmed on real servers).

  - New `@latestarr/adapter-jellyfin` package: one client over the API Jellyfin and Emby share (`/System/Info`, `/Library/MediaFolders`, `/Users`, `/Items`, `/Items/{id}/Images/Primary`), with two thin adapters, `jellyfin` and `emby`. They differ only in how the key is sent (Jellyfin: `Authorization: MediaBrowser Token="…"`; Emby: `X-Emby-Token`) and in the web app's item link format. The key is never put in a URL.
  - Recent items are sorted by date added (neither server filters on it), requested once per chosen library, and cut at the lookback window. Episodes are titled by series with an `SxxExx - episode` subtitle and use the series poster. Books and audiobooks show their author; audiobooks show their length.
  - Web: both appear in Add source with an API-key hint and a "needs testers" note linking to [#196](https://github.com/jshields-ca/LatestArr/issues/196), and support Import users. README marks both "🧪 Needs testers" with a call for testers.

  </details>

- [#202](https://github.com/jshields-ca/LatestArr/pull/202) [`7df281b`](https://github.com/jshields-ca/LatestArr/commit/7df281bd3b05f867195919558a588778c86f8843) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** Preview a newsletter before it goes out. The new **Preview** button shows exactly what the next send would contain, with real items, images, and your intro and buttons, without emailing anyone. From the same window you can send a test copy to just yourself.

  <details>
  <summary>Technical details</summary>

  Closes [#193](https://github.com/jshields-ca/LatestArr/issues/193). `apps/server/src/pipeline/run-newsletter.ts` now separates loading a newsletter (`loadNewsletter`), its SMTP sender (`loadSender`), and rendering from delivery. Real sends, `previewNewsletter`, and `sendTestNewsletter` all use the same render path, so the preview matches the sent email.

  - `POST /newsletters/:id/preview` returns `{ subject, html, items }`. Embedded images (normally `cid:` attachments) are swapped for inline `data:` URIs so a browser can show them. It needs no SMTP profile, creates no send-run, and doesn't affect missed-send catch-up. A failure returns 502 with the same readable reason as Send now and is logged as a warning.
  - `POST /newsletters/:id/send-test` (`{ to }`) sends the render to one address with a `[Test]` subject prefix, with no send-run, and logs `Sent a test of "…" to …` with `trigger: "test"` and the admin's email.
  - Web: `NewsletterPreviewDialog` renders the HTML in a sandboxed `<iframe srcdoc>` (no scripts or same-origin access; popups allowed so the email's links open in a new tab) and prefills the test address with the signed-in admin's email via a new `useOptionalAuth()`.

  This preview is also the live preview the upcoming design editor ([#199](https://github.com/jshields-ca/LatestArr/issues/199)) and code mode ([#200](https://github.com/jshields-ca/LatestArr/issues/200)) will build on.

  </details>

- [#204](https://github.com/jshields-ca/LatestArr/pull/204) [`3d4ec3f`](https://github.com/jshields-ca/LatestArr/commit/3d4ec3f92fc9b91c17bf17d9259f5d3e8ada6703) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** Get alerted when a scheduled newsletter fails. A new **Notifications** page can email you through one of your SMTP profiles, post to Discord, Slack, ntfy, or Apprise, or send generic JSON to your own endpoint. It covers sends that fail entirely, sends that only reach some recipients, and newsletters that can't send at all, for example because their SMTP profile was deleted. Use **Send test alert** to check a destination before saving.

  <details>
  <summary>Technical details</summary>

  Closes [#195](https://github.com/jshields-ca/LatestArr/issues/195).

  - `apps/server/src/notifications/alerts.ts`: settings live in the `settings` table (key `notifications`), with the webhook URL encrypted like other credentials, since Discord and Slack webhook URLs grant posting rights. `sendFailureAlert` never throws, rate-limits to one alert per newsletter and kind per hour (in memory), and logs each delivery attempt. Formats: Discord `{content}`, Slack `{text}`, ntfy plain-text body with `Title`/`Priority`/`Tags` headers, Apprise `{title, body, type}`, and generic JSON `{event, title, message, newsletter, trigger, sendRunId, time}`. Webhook requests time out after 10s.
  - `run-newsletter.ts` alerts for scheduled and catch-up sends only: on a thrown failure (including `NewsletterMisconfiguredError`, but not an overlapping run or a deleted newsletter), when a send reaches none of its recipients, and on partial failure. Manual Send now never alerts.
  - `GET/PUT /notifications` (the URL is never returned, only `hasUrl`/`urlHost`; an omitted `url` keeps the saved one; `http(s)` only) and `POST /notifications/test`, which tests the settings as entered without saving them.
  - SMTP credential building moved to a shared `mailer/credentials.ts` (`smtpCredentialsFor`), used by the SMTP profile routes, the send pipeline, and alerts.
  - Web: `/notifications` page (nav item "Notifications") with an explicit Save; the only SMTP profile and the admin's email are prefilled. Documented under "Failure alerts" in `docs/self-hosting.md`.

  </details>

- [#215](https://github.com/jshields-ca/LatestArr/pull/215) [`ebc2c5c`](https://github.com/jshields-ca/LatestArr/commit/ebc2c5cd159479bca6d17bcb5719d90bd781b0b4) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** The Docker image now runs on Node.js 24, the current long-term support release. Node 22 stops getting security fixes in April 2027. Nothing changes for your setup: pull the new image and restart, and your data and settings carry over.

  <details>
  <summary>Technical details</summary>

  Closes [#186](https://github.com/jshields-ca/LatestArr/issues/186).

  - `docker/Dockerfile`: both stages use `node:24-alpine`.
  - `.nvmrc` and `engines.node` are 24; `@types/node` is `^24.19.0` in every package, matching the runtime (Dependabot still ignores its majors).
  - CI tests on Node 24 and 26 (26 becomes LTS in October 2026); the release workflow runs on 24.

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

- [#239](https://github.com/jshields-ca/LatestArr/pull/239) [`03d9f31`](https://github.com/jshields-ca/LatestArr/commit/03d9f3130f9fc28d1f51663107b7e5a346b4d3d6) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** A security review for installs exposed to the internet. The container no longer runs as root, and someone given a temporary password must change it before they can do anything else. Sources and mail servers that stop responding now time out instead of holding up a send, and server errors no longer show internal details. A new guide covers exposing LatestArr safely.

  <details>
  <summary>Technical details</summary>

  Found and fixed in the review for [#237](https://github.com/jshields-ca/LatestArr/issues/237):

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

- [#238](https://github.com/jshields-ca/LatestArr/pull/238) [`b3657dd`](https://github.com/jshields-ca/LatestArr/commit/b3657ddff1f5e4911d1ec7b30b432fdd77e30f51) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** Newsletters can now show where to watch. Designs add a button for each linked source that has a public URL, such as **Watch on Plex**, **Read on BookLore** or **Play on RomM**. You choose where the buttons go: after the items, under each section, or near the top. You can also place your own buttons above the intro, below it, or at the end.

  <details>
  <summary>Technical details</summary>
  - New design settings: `content.sourceButtons` `{ enabled (default true), placement: "top" | "sections" | "end" (default "end") }` and `content.ctaPlacement: "beforeIntro" | "afterIntro" (default) | "end"`. With grouping off, "sections" falls back to "end". ([#234](https://github.com/jshields-ca/LatestArr/issues/234), [#235](https://github.com/jshields-ca/LatestArr/issues/235))
  - `buildSourceButtons` (`render/source-buttons.ts`) builds the buttons from each linked source's public URL only, never its base URL.
    - The verb and service name come from the source type; a Tautulli source's button says Plex.
    - Sources that share a URL become one button.
    - When two buttons would have the same label, each uses its source's name instead. ([#234](https://github.com/jshields-ca/LatestArr/issues/234))
  - Source buttons are outlined; your own buttons stay filled.
  - Code-mode designs get `{{#each sourceButtons}}` (`label`, `url`, `kinds`) and the `{{#sourceButtonsFor contentType="movie,tv_episode"}}` helper, both listed in the code reference.
  - The design preview shows sample buttons.
  - The Default design's output is unchanged when no source has a public URL.

  </details>

- [#208](https://github.com/jshields-ca/LatestArr/pull/208) [`fae90c9`](https://github.com/jshields-ca/LatestArr/commit/fae90c9d32ce0bd94b337c0f8c8fb21ddb2ed2f0) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** A newsletter's intro, footer note, buttons, and font are now part of its design, set in the design editor where the live preview shows them. The newsletter's settings keep to what goes out, when, and to whom. When you upgrade, each newsletter's existing text, buttons, and font move into a design automatically, so every email looks exactly as before. A newsletter on Default with any of those set gets its own copy of Default, named after it.

  <details>
  <summary>Technical details</summary>

  Closes [#207](https://github.com/jshields-ca/LatestArr/issues/207) (part of [#199](https://github.com/jshields-ca/LatestArr/issues/199)).

  - Design settings gain `content: { intro, footerNote, ctas }` (up to 4 buttons, http(s) links only). The pipeline passes them to every template as `{{introText}}`, `{{footerNote}}`, and `{{#each ctas}}`, so code templates keep working. The Default design no longer takes a per-newsletter font.
  - `render/migrate-content-into-designs.ts` runs once at startup (flagged by the `migration.contentIntoDesigns` settings key). Newsletters sharing a design with different text get a copy each; newsletters with no text keep the original. The old `newsletters` columns stay unused for one release so you can roll back.
  - The newsletter API no longer accepts `emailFont`, `introText`, `footerNote`, or `ctas`. The design editor gets a "Text and buttons" section; Save waits until every button is complete, and half-finished buttons are left out of the preview.

  </details>

- [#222](https://github.com/jshields-ca/LatestArr/pull/222) [`bd3753b`](https://github.com/jshields-ca/LatestArr/commit/bd3753b11564e10bcdd459f806bdceb411583d3a) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** Newsletters now include a plain-text version alongside the HTML, which spam filters prefer and text-only email readers can show. The deliverability guide also explains how to check your DKIM record when a received email reports `dkim=temperror` or `dkim=fail`.

  <details>
  <summary>Technical details</summary>

  Closes [#220](https://github.com/jshields-ca/LatestArr/issues/220).

  - `render/plain-text.ts` converts the rendered HTML with `html-to-text`: wrapped at 78 characters, links shown as `Title [url]`, images and styles dropped. It is generated from the final HTML, so code designs get one too. Sent as `text` on both real sends and test sends, so messages become `multipart/alternative`.
  - `docs/deliverability.md`: a "temperror or fail" section on checking the DKIM selector record, and a note about the text part.

  </details>

### Patch Changes

- [#179](https://github.com/jshields-ca/LatestArr/pull/179) [`c26f5a4`](https://github.com/jshields-ca/LatestArr/commit/c26f5a47e51d2efcbb8e7c86847168c3bcff116a) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** Setting `TRUST_PROXY=true` in `.env` now takes effect. Before, Docker Compose never passed it to the container, so instances behind a reverse proxy saw every visitor as the proxy's IP address (sharing one sign-in rate limit) and didn't mark the session cookie as secure.

  <details>
  <summary>Technical details</summary>

  Closes [#176](https://github.com/jshields-ca/LatestArr/issues/176). `TRUST_PROXY` was documented in `.env.example` and `docs/self-hosting.md` but missing from `docker-compose.yml`'s `environment:` block, so `process.env.TRUST_PROXY` was always unset inside the container and Fastify's `trustProxy` stayed off. Added `TRUST_PROXY: ${TRUST_PROXY:-}`.

  CI now fails if any key in `.env.example` isn't referenced in `docker-compose.yml`, so a newly documented setting can't be silently dropped again.

  </details>

- [#221](https://github.com/jshields-ca/LatestArr/pull/221) [`f8224b7`](https://github.com/jshields-ca/LatestArr/commit/f8224b70fe1687e38dc3fee2408168929908d058) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** TV episodes from Plex and Tautulli now show the show's poster instead of a wide video still, so every image in the newsletter is the same shape. Items with no runtime, page count, or rating no longer leave an empty line, and a rating on its own no longer starts with a stray "·".

  <details>
  <summary>Technical details</summary>

  Closes [#217](https://github.com/jshields-ca/LatestArr/issues/217).

  - Plex uses `grandparentThumb` for episodes, and Tautulli uses `grandparent_thumb`, each falling back to the episode's own `thumb`. Seasons already use their own portrait art.
  - The render context gains `detailsLine`: runtime, pages, length, or platform, then rating, joined with " · ". Designs render the details line only when it has content. The code-mode reference lists `detailsLine`, and the individual fields are unchanged for existing code designs.

  </details>

- [#188](https://github.com/jshields-ca/LatestArr/pull/188) [`e2c0c52`](https://github.com/jshields-ca/LatestArr/commit/e2c0c525d3f63aa0aef4beaab9c451a72111011a) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** Building or developing LatestArr from source now needs Node.js 22 or newer. Node 20 reached end of life in April 2026. Nothing changes if you run the Docker image, which already uses Node 22.

  <details>
  <summary>Technical details</summary>

  `engines.node` is now `>=22` and the CI matrix tests Node 22 (what the Docker image runs) and Node 24 (the next LTS) instead of 20 and 22. This unblocks `jsdom` 30, which requires Node `^22.22.2 || ^24.15.0 || >=26`.

  </details>

- [#229](https://github.com/jshields-ca/LatestArr/pull/229) [`724e97f`](https://github.com/jshields-ca/LatestArr/commit/724e97f1844cd94dbbf6c6e51afae9aa67efc192) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** The Add source dialog's example name and addresses now match the source type you pick (for example `http://localhost:8096` for Jellyfin), instead of always showing Tautulli's. A design switched to code no longer opens with about 25 lines of generated dark-mode styles. One short comment stands in for them and adds them when the email is sent; delete it to leave them out.

  <details>
  <summary>Technical details</summary>

  Closes [#228](https://github.com/jshields-ca/LatestArr/issues/228).

  - `sources-page.tsx`: each source kind has `examples` for the Name, Base URL, and Public URL placeholders, used in the Add and Edit dialogs.
  - `render/design.ts`: `buildDesignMjml(settings, { darkModeMarker: true })` writes a `<!-- latestarr:dark-mode … -->` marker instead of the generated head styles, and `expandDarkModeMarker` replaces it with them at render time. That happens in the send pipeline, previews, and the sample preview. Convert-to-code uses the marker. Code designs without it, including old drag-and-drop templates, are unchanged.

  </details>

- Updated dependencies [[`586a3b6`](https://github.com/jshields-ca/LatestArr/commit/586a3b686d504b0db46d5c34e6fecaa4d50a25b4), [`7159892`](https://github.com/jshields-ca/LatestArr/commit/71598927c31c910b27368e39e554984e95b3aa54), [`08172d5`](https://github.com/jshields-ca/LatestArr/commit/08172d5c7cd24f7d7e1181bcab5191e0bf8156dd), [`e367342`](https://github.com/jshields-ca/LatestArr/commit/e367342bb3c1d3bc3c1c5232a71bfc5c7e15bb5e), [`f8224b7`](https://github.com/jshields-ca/LatestArr/commit/f8224b70fe1687e38dc3fee2408168929908d058), [`1760569`](https://github.com/jshields-ca/LatestArr/commit/1760569a54163bc88a565e9854e614f113a4f08f), [`cb8fb8e`](https://github.com/jshields-ca/LatestArr/commit/cb8fb8e03b0d4a2e03772b9d193599ca8f7fdb0e), [`03d9f31`](https://github.com/jshields-ca/LatestArr/commit/03d9f3130f9fc28d1f51663107b7e5a346b4d3d6), [`fae90c9`](https://github.com/jshields-ca/LatestArr/commit/fae90c9d32ce0bd94b337c0f8c8fb21ddb2ed2f0)]:
  - @latestarr/db@0.11.0
  - @latestarr/adapter-audiobookshelf@0.11.0
  - @latestarr/adapter-romm@0.11.0
  - @latestarr/adapter-jellyfin@0.11.0
  - @latestarr/adapter-plex@0.11.0
  - @latestarr/adapter-tautulli@0.11.0
  - @latestarr/adapter-core@0.11.0
  - @latestarr/adapter-booklore-family@0.11.0
  - @latestarr/crypto@0.11.0

## 0.10.0

### Minor Changes

- [#147](https://github.com/jshields-ca/LatestArr/pull/147) [`d2c7c33`](https://github.com/jshields-ca/LatestArr/commit/d2c7c33833d4ab6a2eb802e7270b51a9a83113be) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** Import a Plex or Tautulli source's known users as recipients, grouped together, from the Sources page.

  <details>
  <summary>Technical details</summary>

  `SourceAdapter` (`packages/adapters/core/src/source-adapter.ts`) gains an optional `listUsers?(config): Promise<SourceUser[]>`, the same optional-capability pattern as `fetchPopularItems`/`fetchImageBytes`. Implemented for:

  - **Tautulli**, via its `get_users` API (`getUsers` in `tautulli-client.ts`) — includes each user's `email` when Tautulli has it (synced from the underlying Plex server's shared-user list), filtering out its "Local" pseudo-user (id 0).
  - **Plex**, via the local server's own `/accounts` endpoint (`getAccounts` in `plex-client.ts`) — usernames only, no email. A local server token can't reach plex.tv's own account API, which is the only place a shared user's email is visible; `SourceUser.email` is optional specifically to let a caller (and `NewItem`'s doc comment) handle this per-source gap rather than assuming every source can supply one.

  New `GET /sources/:id/users` (`apps/server/src/http/routes/sources.ts`) 404s (not a 200 with an empty array) when the adapter doesn't implement `listUsers`, so the web UI can tell "unsupported" apart from "zero users right now."

  New "Import users" action on a Plex/Tautulli source row (`apps/web/src/pages/sources-page.tsx`) opens a dialog listing the source's users — pre-checked when they have an email, disabled when they don't (a recipient can't exist without one) — and imports the selected ones via the existing bulk-import endpoint (`POST /recipients/import`, from the CSV/text-paste import feature), then adds each newly-created recipient to a group named after the source, reusing an existing group of that name on a repeat import rather than creating a duplicate.

  </details>

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

- [#169](https://github.com/jshields-ca/LatestArr/pull/169) [`da01590`](https://github.com/jshields-ca/LatestArr/commit/da015906952997d63dfa90a424882471f9554c06) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** The Recipients table's Name column no longer reads as cramped against the left border.

  **New:** The Edit recipient dialog now lets you add or remove group membership — and create a brand-new group — without leaving the dialog.

  <details>
  <summary>Technical details</summary>
  - `apps/web/src/pages/recipients-page.tsx`: the Name `<td>` was missing the left padding its `<th>` had (`px-4` vs `pr-4`-only), so header text sat indented while row text sat flush against the border.
  - Added `GET /recipients/:id/groups` (`apps/server/src/http/routes/recipients.ts`) — the reverse of the existing `GET /recipient-groups/:id`'s `members`, so a recipient-centric UI doesn't need to fetch every group's member list to figure out which ones a given recipient is already in.
  - Added `RecipientGroupsField` to `EditRecipientDialog`, mirroring the Newsletters page's `LinkedGroups` pattern (add-via-dropdown, remove-via-chip) plus an inline "create a new group" shortcut that creates and adds in one action. Reuses the existing `POST/DELETE /recipient-groups/:id/members` endpoints — no new mutation endpoints needed.

  </details>

- [#149](https://github.com/jshields-ca/LatestArr/pull/149) [`7c67462`](https://github.com/jshields-ca/LatestArr/commit/7c674628a7b432739f379d6b5a2fb7dc72928ac5) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** A Logs page in the web UI shows recent server activity — failed sends, source sync errors, auth events, and anything else worth troubleshooting — without needing to `docker logs` the container.

  <details>
  <summary>Technical details</summary>

  The server's pino logger now writes to two destinations via `pino.multistream`: stdout (unchanged — still what `docker logs` shows) and a new in-memory ring buffer (`apps/server/src/log-buffer.ts`, capped at 500 entries), which drops Fastify's routine per-request "incoming request"/"request completed" pair so the buffer holds actual events instead of being drowned out by ordinary traffic. New `GET /logs` (`?level=warn|error|...` and `?limit=`) serves recent entries with a human-readable level label.

  The new Logs page polls this on load/refresh/filter-change, showing each entry's level (color-coded), timestamp, and message, with a "Details" toggle that expands the entry's full raw context (request info, error type/message/stack) for whichever ones carry it.

  Note for anyone extending `apps/server/src/app.ts`: pino's actual destination is its _second_ constructor argument — `pino(multistreamResult)` alone silently falls back to pino's own default stdout destination and never writes to any custom stream in the multistream array; it has to be `pino(options, multistreamResult)`. Confirmed via a minimal repro while building this — easy to get wrong and have it look like it's working (the primary stdout destination still logs normally) while the second destination silently receives nothing.

  </details>

- [#146](https://github.com/jshields-ca/LatestArr/pull/146) [`91e6ad5`](https://github.com/jshields-ca/LatestArr/commit/91e6ad55f87329fd0b4ce833b8dc170565e613b2) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** Bulk-import recipients by pasting a list of emails or uploading a CSV, instead of adding people one at a time.

  <details>
  <summary>Technical details</summary>

  New "Import" button on the Recipients page opens a dialog with a paste area (or an "Upload CSV" button that reads a file's text into the same field). `apps/web/src/lib/recipient-import.ts` parses the pasted/uploaded text tolerating the formats people actually paste: one bare email per line, `email,Name` or `Name,email` CSV-style pairs (either order), `Name <email>` mailto-style entries, and a flat comma/semicolon-separated address list copied straight from a mail client's To field — with a live "N recipients ready to import, M lines couldn't be parsed" preview and the unparseable lines shown before anything is submitted.

  New `POST /recipients/import` (`apps/server/src/http/routes/recipients.ts`) accepts the parsed rows and processes them one at a time rather than as a single multi-row insert, so one bad or duplicate row doesn't fail the whole batch — it returns which rows were `created` and which were `skipped` with a reason (invalid email, already exists, or duplicate within the same import), which the dialog displays after submitting.

  </details>

- [#148](https://github.com/jshields-ca/LatestArr/pull/148) [`832eebc`](https://github.com/jshields-ca/LatestArr/commit/832eebc286ee6a8116ced59e1ec58a32788f8108) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** Recent Sends history now shows exactly who a send went to and what it included, with a link to the actual rendered copy — not just aggregate counts.

  <details>
  <summary>Technical details</summary>

  `send_runs` gains two columns, set once rendering succeeds (independent of whether individual recipient deliveries later fail): `items_snapshot` (a lightweight `{title, kind}[]` JSON snapshot — the same set `item_count_included` has always counted, now also captured with titles) and `rendered_html` (the actual HTML that was sent, stored verbatim rather than re-rendered on demand, so it reflects exactly what a recipient received even if templates/sources changed since).

  Per-recipient detail already existed in `send_run_recipient_results` (populated by the send pipeline, but never exposed) — new `GET /newsletters/:id/send-runs/:runId/recipients` joins it with `recipients` for each row's email/displayName. New `GET /newsletters/:id/send-runs/:runId/html` serves the stored `rendered_html` directly as `text/html` (a link target, not a JSON-fetched value). The existing list endpoint (`GET /newsletters/:id/send-runs`) explicitly excludes `rendered_html` from each row — it can be tens to hundreds of KB and the list can return many runs at once.

  The newsletter History tab's send-run rows gain a "Details" toggle (only shown when there's something to show) that lazily fetches recipients and renders included-item badges, a per-recipient status list, and a "View a copy of this send" link to the raw HTML endpoint.

  </details>

### Patch Changes

- Updated dependencies [[`d2c7c33`](https://github.com/jshields-ca/LatestArr/commit/d2c7c33833d4ab6a2eb802e7270b51a9a83113be), [`59845f4`](https://github.com/jshields-ca/LatestArr/commit/59845f425654c5363990dbaaa4d06807bbac17c7), [`05eba36`](https://github.com/jshields-ca/LatestArr/commit/05eba36b8e3c431443a7e2b9179b7e366d8592fd), [`28ff9e1`](https://github.com/jshields-ca/LatestArr/commit/28ff9e138aeec841c33aecc68539550e9ef77001), [`1484a0c`](https://github.com/jshields-ca/LatestArr/commit/1484a0cd44987df71261be17bbb4429fe20d1e4a), [`832eebc`](https://github.com/jshields-ca/LatestArr/commit/832eebc286ee6a8116ced59e1ec58a32788f8108)]:
  - @latestarr/adapter-core@0.10.0
  - @latestarr/adapter-plex@0.10.0
  - @latestarr/adapter-tautulli@0.10.0
  - @latestarr/adapter-booklore-family@0.10.0
  - @latestarr/db@0.10.0
  - @latestarr/adapter-audiobookshelf@0.10.0
  - @latestarr/adapter-romm@0.10.0
  - @latestarr/crypto@0.10.0

## 0.9.0

### Minor Changes

- 0e4c89a: **New:** Newsletter items are now clickable — a movie, show, book, audiobook, or game in a sent newsletter links straight to that item on its source (Plex, Tautulli, Audiobookshelf, RomM, or a BookLore-family reader), instead of being plain unlinked text.

  <details>
  <summary>Technical details</summary>

  Two gaps combined to make nothing in a sent newsletter clickable before this: `sourceConnections` had only one URL column (`baseUrl`), used both for an adapter's own API calls and as the one place a link was ever rendered (the Media List block's `emptyFallback="link"` fallback) — which breaks for Tautulli (`baseUrl` is the Tautulli API host, not a Plex-watchable URL) and for a source whose `baseUrl` is a Tailscale/LAN address unreachable by an email recipient. And `NewItem.externalUrl` (`packages/adapters/core/src/source-adapter.ts`), though already threaded through the render pipeline (`RenderableItem.externalUrl` in `apps/server/src/render/mjml-template.ts`), was never actually set by any adapter.

  Adds an optional `publicUrl` column to `source_connections` (`packages/db/src/schema.ts`, migration `packages/db/drizzle/0001_nostalgic_ulik.sql`, generated with `drizzle-kit generate`) — the address a recipient can actually reach, falling back to `baseUrl` when unset so every existing source connection keeps behaving exactly as it does today. Threaded through `SourceConnectionConfig` (`packages/adapters/core/src/source-adapter.ts`) and the Sources API (`apps/server/src/http/routes/sources.ts`, validated as a URL when present, or an empty string to clear it).

  Every adapter now builds a real per-item deep link where the source's URL scheme supports it:
  - **Plex**: `{publicUrl}/web/index.html#!/server/{machineIdentifier}/details?key=%2Flibrary%2Fmetadata%2F{ratingKey}` — fetches the server's `machineIdentifier` from `/identity` (new `getServerIdentity` in `plex-client.ts`) once per fetch, falling back to a plain library link if that lookup fails. An unset `publicUrl` falls back to building the same link from `baseUrl`, matching today's behavior for a fully-public single-Plex setup.
  - **Tautulli**: the same Plex web deep-link format, built from Tautulli's own `get_server_id` API (proxying the underlying Plex server's `machineIdentifier`) and `rating_key` — shares `buildPlexWebDeepLink` with the Plex adapter (new export in `packages/adapters/core/src/url-utils.ts`). Unlike every other adapter here, an unset `publicUrl` means **no** `externalUrl` is set at all (not a `baseUrl` fallback) — Tautulli's own `baseUrl` is its API host, never a page a recipient should be sent to, so building a link from it would produce a plausible-looking link to a page that doesn't exist there; this exactly matches Tautulli-linked items' behavior before this release (no link) rather than introducing a new broken one. The `get_server_id` lookup itself is skipped entirely (not just its result discarded) when there's no `publicUrl` to build a link from, so a Tautulli connection with no `publicUrl` set makes no additional API calls at all.
  - **BookLore family** (BookLore/BookOrbit/Grimmory): reads an OPDS entry's own `rel="alternate"`/`rel="self"` link (new `getEntryPermalinkHref` in `booklore-client.ts`) and rebases it onto `publicUrl`'s origin (new `withOrigin` helper) instead of the internal host the feed itself was served from — but only when the permalink resolves to `baseUrl`'s own origin; a permalink that already points at a genuinely different, distinct host (some catalogs point `rel="alternate"` at a publisher/mirror page) is left untouched instead of being force-rebased into a broken URL. Falls back to the library root when an entry carries no usable permalink at all. An entry's OPDS `<link>` is untrusted content from the source server itself, so its scheme is validated (`isHttpUrl`, new export alongside `withOrigin`) before ever being used — a `javascript:`/`data:` href is treated as "no usable permalink" rather than reaching a sent email's `<a href>` (Handlebars' default `{{}}` escaping used to render `{{externalUrl}}` guards markup characters, not URL schemes, so nothing downstream would otherwise have caught this). An unset `publicUrl` falls back to `baseUrl`.
  - **Audiobookshelf**: `{publicUrl}/item/{itemId}`, falling back to `baseUrl` when unset.
  - **RomM**: `{publicUrl}/rom/{id}`, falling back to `baseUrl` when unset.

  The Sources API's `publicUrl` field is itself restricted to `http`/`https` (`apps/server/src/http/routes/sources.ts`), for the same reason: it flows straight into every adapter's link construction.

  The default (non-custom-template) newsletter layout (`apps/server/src/render/newsletter-template.ts`) now wraps an item's title and poster in `<a href="{{externalUrl}}">` when present, styled to inherit the surrounding text color with no underline so a linked title doesn't read differently from an unlinked one; falls back to plain text/image otherwise. The Media List block's `emptyFallback="link"` "browse the library" link (`apps/server/src/pipeline/run-newsletter.ts`'s `buildSourceLinksByContentType`, consumed by `mjml-template.ts`) now prefers `publicUrl` over `baseUrl` too.

  </details>

### Patch Changes

- 9dcab81: **Fixed:** Every item in a sent newsletter now shows a small badge naming what it is — "Movie", "TV Episode", "TV Season", "Game", "Book", or "Audiobook". Previously only Ebooks, Comics, Audiobooks and Podcasts (from BookLore-family and Audiobookshelf) got a badge; movies, TV episodes, TV seasons and games showed no badge at all.

  <details>
  <summary>Technical details</summary>

  The badge markup in both the default template (`apps/server/src/render/newsletter-template.ts`) and the GrapesJS-authored one (`apps/web/src/lib/grapesjs-blocks.ts`'s `CONTENT_LABEL_BADGE`) has always rendered `{{contentLabel}}`, an optional, adapter-set free-text field on `NewItem` — only BookLore-family and Audiobookshelf ever set it (to distinguish Ebook/Comic within "book" or Audiobook/Podcast within "audiobook"). The `kind` field itself (movie/tv_episode/tv_season/book/audiobook/game) was never mapped to a display label anywhere in the render path.

  Rather than duplicating a label map in both consumers, the fallback is resolved once, upstream of both: `apps/server/src/render/mjml-template.ts`'s `toRenderable()` (the single function both the default and custom/GrapesJS-authored templates' items pass through before either ever sees them) now resolves `contentLabel` via a new `KIND_LABELS` map when the adapter didn't set one, so `RenderableItem.contentLabel` is always populated. Both templates already just read `{{contentLabel}}`, so neither needed any change — `grapesjs-blocks.ts`'s badge markup works unmodified. An adapter-set `contentLabel` (Comic, Podcast, etc.) still takes priority over the kind fallback.

  </details>

- 9dcab81: **Improved:** The default newsletter layout now opens with a short line under the title ("Here's what's new in the last 7 days.", using your newsletter's own lookback setting) and its footer now links to LatestArr's GitHub repo and to where you can report an issue.

  <details>
  <summary>Technical details</summary>

  Both changes are in the default MJML template (`apps/server/src/render/newsletter-template.ts`), the layout a newsletter falls back to when no custom template is picked.

  Intro line: `NewsletterRenderContext` and `MjmlRenderContext` (`apps/server/src/render/mjml-template.ts`) both gained an optional `lookbackDays?: number`, threaded from `newsletter.lookbackDays` (`packages/db/src/schema.ts`) through `renderNewsletterContent` in `apps/server/src/pipeline/run-newsletter.ts`'s call to `renderDefaultNewsletterHtml`, and bound as `{{lookbackDays}}` in the Handlebars data `renderMjmlTemplate` passes to `Handlebars.compile`. Guarded by `{{#if lookbackDays}}` so the line is simply omitted for a caller that doesn't pass it (e.g. existing tests). A custom, GrapesJS-authored template has no built-in use for this today, but can reference `{{lookbackDays}}` directly since it's now part of the general render context.

  Footer links: two plain `<a>` tags added inside the existing footer `<mj-text>`, pointing at `https://github.com/jshields-ca/LatestArr` and `https://github.com/jshields-ca/LatestArr/issues`, styled inline to match the existing muted footer text (no external CSS, consistent with the rest of this template's email-safe conventions).

  </details>

- 9dcab81: **Fixed:** A newly added TV season now shows the show's name (e.g. "Breaking Bad") as its title, with the season itself (e.g. "Season 1") as the subtitle — previously it just showed "Season 1" with no indication of which show it belonged to, the same problem episodes had before an earlier fix.

  <details>
  <summary>Technical details</summary>

  Both `packages/adapters/plex/src/plex-adapter.ts` and `packages/adapters/tautulli/src/tautulli-adapter.ts` already had this fix for `tv_episode` items (promoting the show name from `grandparentTitle`/`grandparent_title` into the primary title, demoting the episode's own name to the subtitle via `buildEpisodeTitle`/`buildEpisodeSubtitle`), but had no equivalent for `tv_season` items.

  Added mirrored `buildSeasonTitle`/`buildSeasonSubtitle` helpers to both adapters. Plex's `PlexMetadataItem` already declared `parentTitle` (the direct-parent show name, one level up from a season — not `grandparentTitle`, which is two levels up and only populated for episodes) but it was never read; it's now used the same way `grandparentTitle` is for episodes. Tautulli's `TautulliRecentlyAddedItem` had no equivalent field, so a `parent_title?: string` field was added to it (mirroring the existing `grandparent_title`/`parent_media_index` fields already proxied through from the underlying Plex server).

  Both fixes fall back to the season's own bare title with no subtitle when the parent-title field is absent, matching the existing defensive pattern for episodes without a `grandparentTitle`/`grandparent_title`. Test cases covering both the happy path and the fallback were added to `plex-adapter.test.ts` and `tautulli-adapter.test.ts`.

  </details>

- @latestarr/adapter-audiobookshelf@0.9.0
  - @latestarr/adapter-booklore-family@0.9.0
  - @latestarr/adapter-core@0.9.0
  - @latestarr/adapter-plex@0.9.0
  - @latestarr/adapter-romm@0.9.0
  - @latestarr/adapter-tautulli@0.9.0
  - @latestarr/crypto@0.9.0
  - @latestarr/db@0.9.0

## 0.8.0

### Patch Changes

- @latestarr/adapter-audiobookshelf@0.8.0
  - @latestarr/adapter-booklore-family@0.8.0
  - @latestarr/adapter-core@0.8.0
  - @latestarr/adapter-plex@0.8.0
  - @latestarr/adapter-romm@0.8.0
  - @latestarr/adapter-tautulli@0.8.0
  - @latestarr/crypto@0.8.0
  - @latestarr/db@0.8.0

## 0.7.1

### Patch Changes

- e65d4c3: Bump croner (9 → 10), the scheduler library. Runtime dependency — this is the highest-risk bump in the deferred major-version pass, since a subtle regression here could silently stop newsletters from firing on schedule rather than failing loudly.

  Extra scrutiny beyond the usual test suite, since `apps/server/src/scheduler/engine.ts`'s missed-schedule catch-up logic (`nextScheduledRunAfter`) always constructs a real `Cron` directly — it isn't behind the tests' injectable `cronFactory` mock, so `apps/server/src/scheduler/engine.test.ts`'s catch-up tests already exercise real croner behavior at exact date boundaries, not a stub:

  - All 11 scheduler tests pass unchanged, including the three missed-schedule catch-up boundary cases.
  - Directly verified `nextRun(since)` is still strictly-after-exclusive of `since` (matching the code's own documented assumption) at the exact same boundary the tests use (`"0 9 * * 1"` around `2024-01-01T09:00:00Z`).
  - Directly verified the exact 3-arg `new Cron(pattern, options, callback)` constructor shape `defaultCronFactory` depends on, plus `.stop()`, still work unchanged.

  `pnpm turbo run lint typecheck build test` is fully green (40/40 tasks).

- 51311b4: Bump eslint (9 → 10) and @eslint/js (9 → 10) across every package, and jsdom (25 → 29.1.1) in apps/web's test environment. Dev-tooling only, no runtime dependency changes.

  The Dependabot PRs for eslint/@eslint/js (#97, #105) failed CI with a stale, out-of-sync pnpm-lock.yaml on their branch — reproduced locally with a freshly regenerated lockfile and confirmed all 40 lint/typecheck/build/test tasks pass cleanly; `eslint-plugin-jsx-a11y`'s declared peer range hasn't caught up to eslint 10 yet, but it lints without error in practice.

  jsdom's own Dependabot PR (#104) proposed 25 → 30, but jsdom 30 dropped Node 20 support entirely (`engines: "^22.22.2 || ^24.15.0 || >=26.0.0"`), which broke this repo's Node 20.x CI job with `TypeError: webidl.util.markAsUncloneable is not a function` — a real Node-runtime incompatibility, not a lockfile issue. Landing on 29.1.1 instead (the latest jsdom release that still supports Node 20.19+) gets most of the version currency without dropping Node 20 CI support, which is a bigger call than a routine dependency bump.

- 73a6d37: Bump vite (6 → 8, apps/web only), vitest (4 → 5, every package), and @vitejs/plugin-react (4 → 6, apps/web only). Dev-tooling only, no runtime dependency changes.

  Bumped all three together since they're an interlocking build/test toolchain — vitest 5 pins a vite 6+ peer, and @vitejs/plugin-react needs to track the vite major it's paired with. `pnpm turbo run lint typecheck build test` is fully green (40/40 tasks, 189 server tests, 225 web tests); no config changes needed in `apps/web/vite.config.ts` or any `vitest.config`.

- Updated dependencies [e4532fd]
- Updated dependencies [51311b4]
- Updated dependencies [73a6d37]
  - @latestarr/db@0.7.1
  - @latestarr/crypto@0.7.1
  - @latestarr/adapter-core@0.7.1
  - @latestarr/adapter-plex@0.7.1
  - @latestarr/adapter-tautulli@0.7.1
  - @latestarr/adapter-audiobookshelf@0.7.1
  - @latestarr/adapter-booklore-family@0.7.1
  - @latestarr/adapter-romm@0.7.1

## 0.7.0

### Patch Changes

- f18f469: Addresses the most common piece of v0.6.0 production feedback: newsletters rendering "very plain, no images/posters/covers." Only the RomM adapter ever populated `posterUrl` — Plex, Tautulli, Audiobookshelf, and the BookLore family all left it empty, so their items never got a poster in the default template or a Media List block, even though the rendering side already supported one.

  Wires poster/cover art through for all four remaining adapters: Plex maps its `thumb` field to a token-bearing absolute URL; Tautulli adds the `thumb`/`art` fields its API was already returning but the client wasn't reading, resolved through its own `pms_image_proxy` command; Audiobookshelf maps `media.coverPath` to its token-bearing cover endpoint; and the BookLore-family client gains real OPDS `<link rel="...image">` parsing (preferring the full image over the thumbnail), which it had none of before.

  Rather than putting a source's own URL (frequently LAN-only, and often carrying that source's credentials as a query param) directly into a sent email, a new pipeline step (`apps/server/src/pipeline/embed-images.ts`) fetches each item's image server-side at send time — using the same stored, decrypted credentials the pipeline already polls that source with, via a new `SourceAdapter.fetchImageBytes()` (replacing the previously unimplemented `resolveImageUrl`) — resizes it to a thumbnail with `sharp`, and attaches it to the outgoing email as a Nodemailer CID attachment. The rendered HTML references it with `<img src="cid:...">`; a recipient's mail client never makes an outbound request of its own. This is applied uniformly to the default template and to the GrapesJS Media List block. Every step fails soft, per item: an unreachable source, a failed fetch, or an image `sharp` can't decode falls back to a small blank-pixel data URI for that one item rather than failing the whole send.

  Embedding only ever happens for images a Media List block's own selection (count/order/showAll/emptyFallback) actually renders — real `posterUrl`s are swapped for opaque placeholder tokens before the template renders, and only the tokens that survive into the compiled HTML get fetched, resized, and attached afterward. Otherwise a block showing 5 items out of an 80-item library would fetch, resize, and attach all 80 posters even though only 5 ever appear in the email, undermining the whole "keep message size sane" point of CID embedding. Referenced images are also fetched/resized concurrently rather than one at a time, and the "most watched" and "empty-pool fallback" item pools are fetched concurrently with each other rather than sequentially. Every adapter's image fetch (`fetchImage`/`fetchOpdsImage`) is also now bounded by a 10s `AbortSignal.timeout()` — since `resolvePosterPlaceholders` awaits every referenced item's image via `Promise.all`, one source that hangs instead of erroring would otherwise stall the whole send indefinitely rather than failing that one item's poster softly.

  Also replaces every adapter client's `baseUrl.replace(/\/+$/, "")` trailing-slash trim with a new shared `trimTrailingSlashes()` helper (`@latestarr/adapter-core`) — a plain linear scan instead of a regex CodeQL flagged as a polynomial-time ("catastrophic backtracking") pattern on uncontrolled input.

  Also, from the same feedback:
  - **TV episode titles**: a `tv_episode` item's prominent title was just the bare episode name (e.g. "Winter Is Coming"), with the series name buried in the subtitle — it now leads with the series title, with "SxxExx - Episode Name" as the subtitle, for both Plex and Tautulli. Rendered items also now show a release date alongside the added date when the source provides one.
  - **Content-kind labeling**: BookLore-family items are now labeled "Ebook", "Comic", or "Book" (derived from the OPDS acquisition link's MIME type), and Audiobookshelf items "Audiobook" or "Podcast", surfaced as a small badge next to the title in both the default template and the Media List block — without widening the shared `MediaKind` enum for it.
  - **Smarter Media List blocks**: a new "Random order" trait picks random items from the matching pool instead of always the first N; a new "Show all items in the period" trait removes the count cap entirely; and a new "When nothing matches this period" trait offers a random-items-instead fallback (sampled from an all-time pool, only fetched when a block actually needs it) or a plain link back to the source, instead of silently rendering an empty section.

- Updated dependencies [f18f469]
  - @latestarr/adapter-core@0.7.0
  - @latestarr/adapter-plex@0.7.0
  - @latestarr/adapter-tautulli@0.7.0
  - @latestarr/adapter-audiobookshelf@0.7.0
  - @latestarr/adapter-booklore-family@0.7.0
  - @latestarr/adapter-romm@0.7.0
  - @latestarr/crypto@0.7.0
  - @latestarr/db@0.7.0

## 0.6.0

### Minor Changes

- 8b0936e: Fix the "default layout" (no custom template picked) newsletter render falling back to a stale, pre-poster hardcoded template with no images and no MJML compilation. It now renders through the same MJML pipeline as a custom GrapesJS template, so a default-layout send gets the same poster + metadata cards, responsive layout, and Outlook/MSO compatibility.

### Patch Changes

- ac67cff: Add regression test coverage in `renderMjmlTemplate` for a bug found while verifying the template editor's new preset blocks (apps/web): a `<table>` placed directly under `<mj-column>` (rather than wrapped in `<mj-raw>`) gets silently dropped by MJML's compiler under "soft" validation, with no thrown error. No production server behavior changes — the fix itself is in `apps/web`'s block library, which is what emits this markup.
- 170698b: Fix a real send-failure bug: a custom template saved from the builder before it's ever had an initial design loaded exports a bare MJML fragment (no `<mjml><mj-body>` root element). `renderMjmlTemplate` now wraps such a fragment before compiling instead of letting `mjml2html` reject it outright — previously this would fail the entire send rather than falling back to best-effort rendering, the same way a malformed template already does.
- 12df8b1: Newsletter admin fixes from design review and a real send-now test run: newsletter cards now show a human-readable schedule ("Weekly on Monday at 8:00 AM") instead of the raw cron string for schedules the Simple picker can express; the Add newsletter dialog defaults Timezone to the browser's own zone instead of always UTC, and pre-selects the SMTP profile when there's exactly one; the Add/Edit newsletter dialogs group their Schedule and Delivery fields into labeled sections instead of one flat list; a "Send now" that completes with nothing actually sent (no linked source or recipient group) is now visually distinguished from a real send in Send History and on the Dashboard; a genuine send failure (e.g. an unreachable source) now returns a specific, structured error instead of a bare "Internal Server Error", shown inline the moment the send fails; and Send History now refreshes automatically right after a "Send now" click resolves instead of requiring a page reload.
- @latestarr/adapter-audiobookshelf@0.6.0
  - @latestarr/adapter-booklore-family@0.6.0
  - @latestarr/adapter-core@0.6.0
  - @latestarr/adapter-plex@0.6.0
  - @latestarr/adapter-romm@0.6.0
  - @latestarr/adapter-tautulli@0.6.0
  - @latestarr/crypto@0.6.0
  - @latestarr/db@0.6.0

## 0.5.0

### Minor Changes

- d5673c5: Give the Media List builder block real poster/cover-art and metadata (runtime, page count, audiobook duration, platform, rating), expand its content-type picker to all six adapter media kinds (movies, TV episodes, TV seasons, books, audiobooks, games), and add real, non-drag Move up/down buttons to every component's toolbar in the template editor.

### Patch Changes

- @latestarr/adapter-audiobookshelf@0.5.0
  - @latestarr/adapter-booklore-family@0.5.0
  - @latestarr/adapter-core@0.5.0
  - @latestarr/adapter-plex@0.5.0
  - @latestarr/adapter-romm@0.5.0
  - @latestarr/adapter-tautulli@0.5.0
  - @latestarr/crypto@0.5.0
  - @latestarr/db@0.5.0

## 0.4.6

### Patch Changes

- d5a8c93: Add a way to edit your own display name and change your password from the admin UI — previously there was no way to do either without direct database access. A new "Edit profile" button next to the sidebar's user info opens a dialog for both; changing the password requires the current password, and accounts that sign in via SSO (no local password) get a clear error if they try.
- @latestarr/adapter-audiobookshelf@0.4.6
  - @latestarr/adapter-booklore-family@0.4.6
  - @latestarr/adapter-core@0.4.6
  - @latestarr/adapter-plex@0.4.6
  - @latestarr/adapter-romm@0.4.6
  - @latestarr/adapter-tautulli@0.4.6
  - @latestarr/crypto@0.4.6
  - @latestarr/db@0.4.6

## 0.4.5

### Patch Changes

- @latestarr/adapter-audiobookshelf@0.4.5
  - @latestarr/adapter-booklore-family@0.4.5
  - @latestarr/adapter-core@0.4.5
  - @latestarr/adapter-plex@0.4.5
  - @latestarr/adapter-romm@0.4.5
  - @latestarr/adapter-tautulli@0.4.5
  - @latestarr/crypto@0.4.5
  - @latestarr/db@0.4.5

## 0.4.4

### Patch Changes

- 1f54bab: Add the ability to edit an existing Recipient, SMTP Profile, or Source connection instead of having to delete and re-create it to fix a typo or rotate a credential. Recipients gain email editing (previously only display name and active/inactive were editable). Sources gain a `PATCH /api/sources/:id` endpoint (previously the only mutations were create/delete/test). Credential fields on Sources and the username/password on SMTP Profiles are never pre-filled (they're not returned decrypted) — leave them blank to keep the stored value, or fill in every credential field for that source kind to replace them all at once.
- @latestarr/adapter-audiobookshelf@0.4.4
  - @latestarr/adapter-booklore-family@0.4.4
  - @latestarr/adapter-core@0.4.4
  - @latestarr/adapter-plex@0.4.4
  - @latestarr/adapter-romm@0.4.4
  - @latestarr/adapter-tautulli@0.4.4
  - @latestarr/crypto@0.4.4
  - @latestarr/db@0.4.4

## 0.4.3

### Patch Changes

- c547058: Fix SMTP connections silently failing with an OpenSSL "wrong version number" error on providers like Dreamhost. The "Use TLS" toggle defaulted on regardless of port, which makes the mailer attempt implicit TLS (wrapping the socket in TLS immediately) — but port 587 (the form's own default) is a STARTTLS port, which expects a plain connection that upgrades to TLS after the initial handshake, not implicit TLS. Sending an implicit-TLS handshake to a STARTTLS-only port fails immediately. The toggle (relabeled "Use implicit TLS (port 465)") now defaults based on the port entered and only overrides that guess once changed manually, and the mailer now sets `requireTLS` when not using implicit TLS so a STARTTLS upgrade failure surfaces as a clear error instead of silently falling back to an unencrypted connection.

  Also fix the Docker container/project name inheriting whatever directory `docker-compose.yml` happens to live in (e.g. `test-latestarr-latestarr-1`) — `docker-compose.yml` now pins its own project and container name to `latestarr` regardless of the checkout's folder name.

- @latestarr/adapter-audiobookshelf@0.4.3
  - @latestarr/adapter-booklore-family@0.4.3
  - @latestarr/adapter-core@0.4.3
  - @latestarr/adapter-plex@0.4.3
  - @latestarr/adapter-romm@0.4.3
  - @latestarr/adapter-tautulli@0.4.3
  - @latestarr/crypto@0.4.3
  - @latestarr/db@0.4.3

## 0.4.2

### Patch Changes

- 80d7e1c: Fix login silently failing (redirects to the dashboard, then immediately shows "Not authenticated", every time, even right after refresh) when accessing the app directly over plain HTTP without a reverse proxy in front — again, exactly the documented default Getting Started flow. The session cookie's `Secure` flag was set based on `NODE_ENV === "production"`, but the Docker image always sets `NODE_ENV=production` regardless of whether TLS is actually in front of the app, so `Secure` was forced on unconditionally; browsers silently refuse to store a `Secure` cookie over a plain HTTP connection, so the cookie set by `/api/auth/login` was simply never kept. `Secure` is now based on the actual request protocol instead, which is `http` unless a reverse proxy is explicitly trusted via the new `TRUST_PROXY=true` env var and forwards `X-Forwarded-Proto: https` (documented in `docs/self-hosting.md`'s reverse-proxy section, which already described this as the intended mechanism).
- @latestarr/adapter-audiobookshelf@0.4.2
  - @latestarr/adapter-booklore-family@0.4.2
  - @latestarr/adapter-core@0.4.2
  - @latestarr/adapter-plex@0.4.2
  - @latestarr/adapter-romm@0.4.2
  - @latestarr/adapter-tautulli@0.4.2
  - @latestarr/crypto@0.4.2
  - @latestarr/db@0.4.2

## 0.4.1

### Patch Changes

- a052e46: Fix the admin UI failing to load entirely (blank page) when accessed directly over plain HTTP without a reverse proxy in front. `@fastify/helmet`'s Content-Security-Policy defaults silently include `upgrade-insecure-requests`, which tells the browser to rewrite every `http://` subresource request (the JS bundle, CSS, favicon) to `https://` before sending it — independent of any browser "HTTPS-Only Mode" setting, and unaffected by exceptions or private browsing. Since LatestArr has no TLS listener of its own (TLS is expected to come from a reverse proxy), those upgraded requests failed outright and the app never rendered. The directive is now explicitly removed from the CSP.
- @latestarr/adapter-audiobookshelf@0.4.1
  - @latestarr/adapter-booklore-family@0.4.1
  - @latestarr/adapter-core@0.4.1
  - @latestarr/adapter-plex@0.4.1
  - @latestarr/adapter-romm@0.4.1
  - @latestarr/adapter-tautulli@0.4.1
  - @latestarr/crypto@0.4.1
  - @latestarr/db@0.4.1

## 0.4.0

### Minor Changes

- 2037414: Catch up newsletters whose scheduled send was missed while the process was down. On boot, the scheduler now checks each enabled newsletter's last actual send (or creation time, if it's never sent) against its cron schedule, and runs it once if a scheduled fire was missed — previously a missed occurrence during downtime just silently never happened.
- 04b0293: Add security headers (`@fastify/helmet`, with a CSP tuned for the GrapesJS builder and Google Fonts), rate limiting (`@fastify/rate-limit`, generous global default plus a strict 10/minute cap on login and bootstrap), and CSRF protection via a same-origin check on every mutating request.
- a097e99: Add an unauthenticated `GET /api/version` endpoint, and show the running version plus links to the GitHub repo (view + star) and the author's site in the admin sidebar. Also make the docker-compose host port configurable via a `PORT` env var, for anyone whose default `3000` collides with another running service.
- a04bea7: Validate every request body with zod (sources, recipients, recipient groups, SMTP profiles, newsletters, templates, auth) instead of ad-hoc `if (!field)` checks. Malformed types (a string where a number is expected, an object where an array is expected) are now rejected with a 400 instead of reaching the database layer.

### Patch Changes

- b1b2130: Publish a container image to `ghcr.io/jshields-ca/latestarr` on every tagged release (`:latest` and `:vX.Y.Z`), so self-hosters can `docker compose pull` instead of always building from source. `docker-compose.yml` now references that image, falling back to building from `docker/Dockerfile` when no matching image exists locally.
- @latestarr/adapter-audiobookshelf@0.4.0
  - @latestarr/adapter-booklore-family@0.4.0
  - @latestarr/adapter-core@0.4.0
  - @latestarr/adapter-plex@0.4.0
  - @latestarr/adapter-romm@0.4.0
  - @latestarr/adapter-tautulli@0.4.0
  - @latestarr/crypto@0.4.0
  - @latestarr/db@0.4.0

## 0.3.0

### Patch Changes

- @latestarr/adapter-audiobookshelf@0.3.0
  - @latestarr/adapter-booklore-family@0.3.0
  - @latestarr/adapter-core@0.3.0
  - @latestarr/adapter-plex@0.3.0
  - @latestarr/adapter-romm@0.3.0
  - @latestarr/adapter-tautulli@0.3.0
  - @latestarr/crypto@0.3.0
  - @latestarr/db@0.3.0

## 0.2.0

### Minor Changes

- 6c9dbfa: Add an Audiobookshelf adapter (`@latestarr/adapter-audiobookshelf`) for connecting audiobook/podcast libraries — authenticates with a bearer token against Audiobookshelf's documented REST API, listing libraries and their recently-added items. Unlike Tautulli/Plex/BookLore, Audiobookshelf has no cross-library "recent items" endpoint, so when no specific libraries are selected the adapter discovers all libraries first and queries each one.
- 20b13fd: Add a BookLore-family adapter (`@latestarr/adapter-booklore-family`) covering BookLore and its compatible forks BookOrbit and Grimmory. These expose their library through OPDS (a standardized Atom-based catalog format, HTTP Basic Auth) rather than a stable internal REST API, so this adapter parses OPDS feeds directly. Since all three forks share the same OPDS surface, this ships as a single adapter factory rather than three near-duplicate implementations — `bookloreAdapter`, `bookOrbitAdapter`, and `grimmoryAdapter` differ only in their `kind` identifier.
- f253894: Add the admin WebUI's authentication flow: a first-run setup screen to create the initial admin account, a login page (local credentials, plus a "Continue with SSO" option when OIDC is configured), session-aware route protection that redirects unauthenticated visitors to sign in, and a logout control. Adds a small `GET /auth/providers` endpoint so the frontend can detect whether OIDC is enabled and whether the initial admin account has been created yet.
- a55c7cf: Add the drag-and-drop newsletter builder: a GrapesJS-based editor (`/templates/:id/edit`, code-split so its ~700kB isn't shipped to every page) with a curated MJML block set plus a custom block library — Header, Footer, and a dynamic Media List block. Media List is the one genuinely dynamic block: a user configures it entirely through three Traits (Content type, Sort, Count) with no HTML/CSS knowledge required, and it exports as a `{{#mediaList ...}}` Handlebars block helper that the server's render pipeline resolves against real item data at send time — including a "most watched" sort backed by the Tautulli `fetchPopularItems` capability added in an earlier release. The Template API now accepts `compiledMjml` on create/update so the builder's export can be persisted alongside the reusable `designJson` project data.
- 1194bec: Add an MJML render pipeline: newsletters linked to a template now render via that template's compiled MJML (substituting real item data through the same Handlebars data-binding layer as the built-in starter template, then compiling to safe, Outlook/Gmail-friendly HTML with `mjml`), falling back to the hardcoded starter template when no custom template is linked or it has no compiled MJML yet.
- ac35fc1: Add a direct Plex adapter (`@latestarr/adapter-plex`) as an alternative to Tautulli for users who don't run a separate Tautulli instance — connect straight to a Plex Media Server using its own token-based API (`X-Plex-Token`), listing libraries and recently-added movies/TV episodes/seasons the same way the Tautulli adapter does.
- 10830fa: Add a RomM adapter (`@latestarr/adapter-romm`) for connecting game ROM libraries — authenticates with a RomM Client API Token (bearer auth) against its documented REST API, listing platforms as libraries and recently-added ROMs. Unlike Audiobookshelf, RomM's rom-listing endpoint accepts a repeatable `platform_ids` filter directly, so a multi-library fetch is a single request rather than a per-library loop.
- 646d74b: Serve the built admin WebUI directly from apps/server in production, so the Docker image is usable end-to-end instead of API-only. Every backend route now lives under `/api` so it can never collide with a client-side route of the same name (e.g. `/sources` the admin page vs. `/sources` the endpoint) now that both are served from one origin.
- d1f0de8: The Sources admin screen no longer hardcodes "Tautulli" as the only connectable source type. It now fetches the list of registered adapter kinds from a new `GET /sources/kinds` endpoint and lets users pick any of them (Tautulli, Plex, BookLore, BookOrbit, Grimmory, Audiobookshelf, RomM), showing the right credential fields (API key, token, or OPDS username/password) for whichever kind is selected.
- f576990: Add the Template CRUD API (create/list/get/update/delete), persisting the drag-and-drop builder's design JSON — a prerequisite for the upcoming GrapesJS builder, which will save to this endpoint.
- 2b58d0c: Wire newsletters to templates: the Newsletters admin screen now has a Template picker (set at creation, or changed/unset on an existing newsletter) with a direct link into the GrapesJS builder for the linked template. The Newsletter CRUD API accepts `templateId` on create and update (including explicit `null` to unlink). This completes the newsletter builder feature end-to-end — a newsletter can now actually use a custom-designed template for its sends.

### Patch Changes

- bc683eb: Fix the release workflow's second crash: `changeset version` auto-formats every `CHANGELOG.md` it touches with the project's own Prettier config (`.prettierrc.cjs` exists at the repo root) by shelling out to `pnpm exec prettier`, but `prettier` was never actually installed as a dependency — only its config file existed. Added `prettier` as a root devDependency so that auto-format step, and the config file that's been sitting unused, actually works.
- a4c79b7: Fix the release workflow's first real run, which crashed immediately: `changesets/action` unconditionally reads each bumped package's own `CHANGELOG.md` to build the "Version Packages" PR description, but the previous PR disabled per-package changelog generation entirely (`"changelog": false`), so that file never existed and the action threw `ENOENT`. Reverted to Changesets' default per-package changelog generation — those files are internal bookkeeping the action needs, not something a self-hoster needs to read. `scripts/write-changelog.mjs` still writes the single consolidated root `CHANGELOG.md` entry the actual GitHub Release pulls its notes from; nothing about the human-facing changelog changes.
- 66c45b5: Fix a real bug in `.changeset/config.json`: every workspace package is `private: true` (this app isn't published to npm), and Changesets' default `privatePackages.version: false` silently skips versioning any private package — meaning every changeset merged since Phase 3 has bumped nothing, and `pnpm version-packages` has been a silent no-op the entire time despite reporting success. Fixed by setting `privatePackages.version: true`.

  Also adds the missing release automation: `.github/workflows/release.yml` opens/updates a "Version Packages" PR whenever changesets are pending on `main` (via `changesets/action`), and cuts a git tag + GitHub Release (with notes pulled from `CHANGELOG.md`) on the push that merges it — this app has no npm package to publish, so "release" means a tag and a GitHub Release, not `npm publish`. Changesets' own per-package changelog generation is disabled (`"changelog": false`) in favor of `scripts/write-changelog.mjs`, which writes one consolidated root `CHANGELOG.md` entry instead of scattering a `CHANGELOG.md` across every internal workspace package — this is a single self-hosted app, not a set of independently-consumed libraries.

- Updated dependencies [6c9dbfa]
- Updated dependencies [20b13fd]
- Updated dependencies [ac35fc1]
- Updated dependencies [10830fa]
- Updated dependencies [dc5a521]
  - @latestarr/adapter-audiobookshelf@0.2.0
  - @latestarr/adapter-booklore-family@0.2.0
  - @latestarr/adapter-plex@0.2.0
  - @latestarr/adapter-romm@0.2.0
  - @latestarr/adapter-core@0.2.0
  - @latestarr/adapter-tautulli@0.2.0
  - @latestarr/crypto@0.2.0
  - @latestarr/db@0.2.0
