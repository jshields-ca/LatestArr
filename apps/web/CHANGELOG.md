# @latestarr/web

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

- [#303](https://github.com/jshields-ca/LatestArr/pull/303) [`4bc955b`](https://github.com/jshields-ca/LatestArr/commit/4bc955ba05cabcc3a4a6073cfd11095db817ad51) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** In the design editor, changing **Background** seemed to change the text colour, and changing **Text** the background. The preview was following your browser's dark mode, and a design's dark version uses Text as the background and Background as the text. Previews now have a **Light / Dark** switch, start in Light, and remember your choice. A note under the colour pickers explains how dark mode is worked out. The newsletter preview has the same switch.

  <details>
  <summary>Technical details</summary>
  - Fixes [#285](https://github.com/jshields-ca/LatestArr/issues/285).
  - An `srcdoc` iframe's `prefers-color-scheme` follows the viewer's browser, so a viewer in dark mode saw `darkPaletteFor()`'s output.
  - New `withPreviewScheme()` (`lib/email-preview.ts`) rewrites the email's `prefers-color-scheme` queries to always-true or never-true, according to the chosen scheme. This also works for code-mode templates with their own dark-mode CSS.
  - New `EmailPreviewFrame` and `PreviewSchemeToggle` (`components/email-preview-frame.tsx`), used by the design editor and the newsletter preview dialog.
  - The choice is kept in `localStorage` (`latestarr:email-preview-scheme`); it falls back to Light when storage is blocked.
  - The sent email is unchanged.

  </details>

- [#305](https://github.com/jshields-ca/LatestArr/pull/305) [`342d273`](https://github.com/jshields-ca/LatestArr/commit/342d273bd18996e1ab4814cbc696a040174b9c73) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** Line breaks in a design's **Intro** and **Footer note** now show in the preview and in sent emails. Before, every line ran together into one paragraph. A blank line leaves a gap between paragraphs.

  <details>
  <summary>Technical details</summary>
  - Fixes [#289](https://github.com/jshields-ca/LatestArr/issues/289).
  - New `textWithLineBreaks()` in `render/mjml-template.ts` escapes each line and joins them with `<br>`. One or more blank lines become a single `<br><br>`.
  - `{{introText}}` and `{{footerNote}}` are now bound as a Handlebars `SafeString`, so code-mode designs get the line breaks too. The text is still escaped, so HTML typed into either box shows as text.
  - The plain-text version keeps the breaks, since `<br>` converts to a newline.

  </details>

- [#310](https://github.com/jshields-ca/LatestArr/pull/310) [`35ca3f2`](https://github.com/jshields-ca/LatestArr/commit/35ca3f20bfd6e037b4ba211deb8735ac545500aa) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** Adding people to a group on the Recipients page is quicker. The dropdown is now a search box. Type part of a name or email to narrow the list (capitals and accents don't matter), then click a person or press Enter to add them. The box stays open, so you can add several people in a row. The list is sorted by name, with numbers first, instead of the order people were added, and inactive people are marked. The recipient list and the edit panel's group list use the same sorting.

  <details>
  <summary>Technical details</summary>
  - Closes [#287](https://github.com/jshields-ca/LatestArr/issues/287).
  - New `components/ui/combobox.tsx`, an accessible ARIA combobox built on the existing Radix Popover. Focus stays in the text box, the active option is tracked with `aria-activedescendant`, and Arrow keys, Home, End, Enter and Escape work. Up to 50 matches show, with a "type to narrow" note beyond that.
  - New `lib/text.ts`:
    - `compareText`: `Intl.Collator` with numeric sorting and base sensitivity;
    - `foldForSearch` and `matchesSearch`: NFD folding, ignoring case and accents.
  - The recipient table's name and email sort and its search use these too.

  </details>

- [#304](https://github.com/jshields-ca/LatestArr/pull/304) [`05de27a`](https://github.com/jshields-ca/LatestArr/commit/05de27a3c7a3f1ec107c77117468b6763f50a9b4) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** On the Recipients page, group changes made in a recipient's edit panel now show straight away in the Groups section below. That covers adding them to a group, removing them, and creating a new group. Before, an open group didn't show the new member, and a group created in the panel wasn't listed until you refreshed the page.

  <details>
  <summary>Technical details</summary>
  - Fixes [#286](https://github.com/jshields-ca/LatestArr/issues/286).
  - The page now loads groups once and shares them. A `GroupSyncContext` lets the edit panel report a new group (added to the list) and membership changes (which bump a version that open groups reload their members on).
  - Members reloads keep the current list showing and ignore stale responses.

  </details>

## 0.11.2

### Patch Changes

- [#270](https://github.com/jshields-ca/LatestArr/pull/270) [`ddf02b5`](https://github.com/jshields-ca/LatestArr/commit/ddf02b5f2a11116dec964a185e29ca0128a9c70b) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** LatestArr has a new icon: a postage stamp with an L, lifted off a rose tile. It replaces the envelope and sparkle in the app, the browser tab, and the social previews, and comes in light and dark versions. The app now also has icons for adding it to your phone's or computer's home screen.

  <details>
  <summary>Technical details</summary>
  - Chosen in [#269](https://github.com/jshields-ca/LatestArr/issues/269), after four exploration rounds (kept on the `design/icon-exploration` branch).
  - `docs/assets/brand/generate.mjs` is the single source for the icon:
    - the brand SVGs (tile, dark, light, maskable, marks, one colour) and PNGs;
    - `apps/web/public` (`favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`);
    - `apps/web/src/components/logo-geometry.ts`, which the in-app `LogoMark` draws from, using per-instance mask IDs.
  - `index.html` adds the PNG favicon, the Apple touch icon, and a `manifest.webmanifest`. The browser theme colour moves to `#c31d4c`.
  - The social images are rendered from `docs/assets/brand/social-preview.html`: `docs/assets/social-preview.png` (1280×640, GitHub and README) and `docs/assets/brand/og-image.png` (1200×630, the website).
  - Usage notes are in `docs/assets/brand/brand.md`.

  </details>

## 0.11.1

### Patch Changes

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

## 0.11.0

### Minor Changes

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

- [#214](https://github.com/jshields-ca/LatestArr/pull/214) [`08172d5`](https://github.com/jshields-ca/LatestArr/commit/08172d5c7cd24f7d7e1181bcab5191e0bf8156dd) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** Import users works for every source that has users, including Plex, Jellyfin, and Emby. Those servers don't share email addresses, so the import list now has an email field next to anyone without one; fill it in and that person is imported too. Audiobookshelf and RomM sources can now import their users as well, with the emails those servers already have. For Emby, a user linked to Emby Connect with an email address is filled in for you.

  <details>
  <summary>Technical details</summary>

  Closes [#213](https://github.com/jshields-ca/LatestArr/issues/213).

  - Import users dialog: users without an email get an "Email for {name}" field. A complete address selects them, and clearing it deselects them. Import sends typed addresses alongside the source's own.
  - Audiobookshelf `listUsers`: `GET /api/users` (needs an admin token); active users only, with `email` when set.
  - RomM `listUsers`: `GET /api/users` (needs the client API token's `users.read` scope, which the error message now names on a 401 or 403); enabled users only, with `email` when set.
  - Jellyfin/Emby `listUsers` skips disabled accounts. Emby uses `ConnectUserName` as the email when it is one (untested on a real server; see [#196](https://github.com/jshields-ca/LatestArr/issues/196)).
  - Import users now appears for Plex, Tautulli, Jellyfin, Emby, Audiobookshelf, and RomM. The BookLore family has no user API over OPDS.

  </details>

- [#211](https://github.com/jshields-ca/LatestArr/pull/211) [`e367342`](https://github.com/jshields-ca/LatestArr/commit/e367342bb3c1d3bc3c1c5232a71bfc5c7e15bb5e) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** Jellyfin and Emby sources, for movies, TV episodes, books, and audiobooks. Add one with an API key. Newsletters show each item's poster, details, and a link that opens it in your server's web app, and you can import the server's users as recipients. **These need testers:** they're built from the published API docs but haven't been tried on a real server yet. If you run Jellyfin or Emby, please [tell us how it went](https://github.com/jshields-ca/LatestArr/issues/196).

  <details>
  <summary>Technical details</summary>

  Part of [#196](https://github.com/jshields-ca/LatestArr/issues/196) (the issue stays open until both are confirmed on real servers).

  - New `@latestarr/adapter-jellyfin` package: one client over the API Jellyfin and Emby share (`/System/Info`, `/Library/MediaFolders`, `/Users`, `/Items`, `/Items/{id}/Images/Primary`), with two thin adapters, `jellyfin` and `emby`. They differ only in how the key is sent (Jellyfin: `Authorization: MediaBrowser Token="…"`; Emby: `X-Emby-Token`) and in the web app's item link format. The key is never put in a URL.
  - Recent items are sorted by date added (neither server filters on it), requested once per chosen library, and cut at the lookback window. Episodes are titled by series with an `SxxExx - episode` subtitle and use the series poster. Books and audiobooks show their author; audiobooks show their length.
  - Web: both appear in Add source with an API-key hint and a "needs testers" note linking to [#196](https://github.com/jshields-ca/LatestArr/issues/196), and support Import users. README marks both "🧪 Needs testers" with a call for testers.

  </details>

- [#236](https://github.com/jshields-ca/LatestArr/pull/236) [`cde219a`](https://github.com/jshields-ca/LatestArr/commit/cde219ace076f4eb093be22f5891dfb292ab547e) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** Sources now show each service's own logo, including Jellyfin and Emby, and the Source type list is alphabetical. The setup checklist also suggests failure alerts and a second admin, both optional.

  <details>
  <summary>Technical details</summary>
  - Bundled `jellyfin.svg` and `emby.svg` from selfh.st/icons (CC BY 4.0), credited in `assets/logos/NOTICE.md`. ([#231](https://github.com/jshields-ca/LatestArr/issues/231))
  - Source types are sorted by display name; the Add source dialog defaults to the first. ([#231](https://github.com/jshields-ca/LatestArr/issues/231))
  - A source row's leading icon is the service logo, with the category icon kept as a fallback (`hasSourceLogo`); the type badge is now plain text. ([#232](https://github.com/jshields-ca/LatestArr/issues/232))
  - The dashboard checklist adds optional **Get failure alerts** (done when an email or webhook alert is enabled for failures) and **Add another admin** (done with more than one user). Screen readers now hear "Done" on completed steps. ([#233](https://github.com/jshields-ca/LatestArr/issues/233))

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

- [#192](https://github.com/jshields-ca/LatestArr/pull/192) [`02ace28`](https://github.com/jshields-ca/LatestArr/commit/02ace2820a9fbaf0fc3b4d8004dabec445b5b133) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** The web UI works better on phones. The Recipients table shows each email under the name instead of cutting it off, dialogs fit the screen and scroll when they're long, buttons no longer squash together, small icons are easier to tap, and iPhones no longer zoom in when you tap a text field.

  <details>
  <summary>Technical details</summary>

  Closes [#187](https://github.com/jshields-ca/LatestArr/issues/187). Measured every page at 375px wide (horizontal overflow, element widths, tap targets under 24px) before and after.

  - `components/ui/button.tsx`: `size="icon"` buttons get `shrink-0`; they were being squeezed to 23px wide in crowded rows.
  - `components/list-row.tsx`: the actions cluster wraps below `sm` instead of shrinking its children (Sources' four actions didn't fit in 309px).
  - `components/ui/dialog.tsx`: `w-[calc(100%-1.5rem)]` side margins, `max-h-[calc(100dvh-2rem)]` with `overflow-y-auto` (dvh tracks mobile browser toolbars), `p-5 sm:p-6`, and a 32px Close target. Removed the per-page `max-h-[90vh]` overrides this makes redundant. The sheet's Close button gets the same target.
  - `components/ui/input.tsx`, `textarea.tsx`, `select.tsx`: `text-base sm:text-sm`. iOS Safari zooms the page when focusing any field under 16px.
  - Recipients table: below `sm` the Email column is hidden and the address shows as a second line in the Name cell; the Status label is hidden (the switch keeps its `aria-label`); Status and Actions shrink to their content. Sort header buttons get a 28px-tall target.
  - Newsletters: linked-source/group chip "×" buttons (also on Recipients) grow from 16px to 24px without changing chip height.
  - Header GitHub/Star icon buttons grow to 28px targets via `-m-1.5 p-1.5`, so the visuals don't move.

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

### Patch Changes

- [#201](https://github.com/jshields-ca/LatestArr/pull/201) [`8fdac6f`](https://github.com/jshields-ca/LatestArr/commit/8fdac6fe94a9272e4882102007c9985eee5495ed) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** The Logs page description now matches what it shows (sends, delivery and source problems, sign-ins, and settings changes) and says the log clears when the server restarts. The page also now shows all 500 entries the server keeps, not just the latest 200, and the empty message reflects the level filter.

  <details>
  <summary>Technical details</summary>

  Closes [#198](https://github.com/jshields-ca/LatestArr/issues/198). The old description promised "source sync errors" (LatestArr never syncs sources in the background; they're only contacted during sends and connection tests) and "routine request traffic is filtered out", which read as false once [#177](https://github.com/jshields-ca/LatestArr/issues/177) started logging every settings change. `logs-page.tsx` now requests `limit=500`, the server's buffer size (`apps/server/src/log-buffer.ts`), instead of the endpoint's default of 200, so "latest 500" is accurate. The empty state is per level filter ("No errors since the server last started.").

  </details>

- [#221](https://github.com/jshields-ca/LatestArr/pull/221) [`f8224b7`](https://github.com/jshields-ca/LatestArr/commit/f8224b70fe1687e38dc3fee2408168929908d058) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** TV episodes from Plex and Tautulli now show the show's poster instead of a wide video still, so every image in the newsletter is the same shape. Items with no runtime, page count, or rating no longer leave an empty line, and a rating on its own no longer starts with a stray "·".

  <details>
  <summary>Technical details</summary>

  Closes [#217](https://github.com/jshields-ca/LatestArr/issues/217).

  - Plex uses `grandparentThumb` for episodes, and Tautulli uses `grandparent_thumb`, each falling back to the episode's own `thumb`. Seasons already use their own portrait art.
  - The render context gains `detailsLine`: runtime, pages, length, or platform, then rating, joined with " · ". Designs render the details line only when it has content. The code-mode reference lists `detailsLine`, and the individual fields are unchanged for existing code designs.

  </details>

- [#241](https://github.com/jshields-ca/LatestArr/pull/241) [`cf24191`](https://github.com/jshields-ca/LatestArr/commit/cf2419137588ef2e0428560bfb694386d6e18ace) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** The main button on each page now glides up on hover and eases when pressed, instead of jumping into place.

  <details>
  <summary>Technical details</summary>
  - Tailwind v4 compiles `hover:-translate-y-0.5` and `active:scale-[0.98]` to the separate `translate` and `scale` properties, but `button.tsx` only transitioned `transform`.
  - The transition list now names `translate` and `scale`, so the lift and press use the intended spring easing. ([#240](https://github.com/jshields-ca/LatestArr/issues/240))

  </details>

- [#243](https://github.com/jshields-ca/LatestArr/pull/243) [`5977cfe`](https://github.com/jshields-ca/LatestArr/commit/5977cfe9e6c82c406390357d97094d2182cd1d16) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** The GitHub star in the header glows and grows on hover again. Its one-time pulse when the page loads had been switching the hover effect off.

  <details>
  <summary>Technical details</summary>
  - `.star-glow-intro` used animation fill mode `both`, so the finished pulse kept applying its last frame, and that overrode the hover and focus styles on `.star-glow`.
  - It now uses `backwards`. The pulse ends at the resting state, so nothing needs holding. ([#242](https://github.com/jshields-ca/LatestArr/issues/242))

  </details>

- [#229](https://github.com/jshields-ca/LatestArr/pull/229) [`724e97f`](https://github.com/jshields-ca/LatestArr/commit/724e97f1844cd94dbbf6c6e51afae9aa67efc192) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** The Add source dialog's example name and addresses now match the source type you pick (for example `http://localhost:8096` for Jellyfin), instead of always showing Tautulli's. A design switched to code no longer opens with about 25 lines of generated dark-mode styles. One short comment stands in for them and adds them when the email is sent; delete it to leave them out.

  <details>
  <summary>Technical details</summary>

  Closes [#228](https://github.com/jshields-ca/LatestArr/issues/228).

  - `sources-page.tsx`: each source kind has `examples` for the Name, Base URL, and Public URL placeholders, used in the Add and Edit dialogs.
  - `render/design.ts`: `buildDesignMjml(settings, { darkModeMarker: true })` writes a `<!-- latestarr:dark-mode … -->` marker instead of the generated head styles, and `expandDarkModeMarker` replaces it with them at render time. That happens in the send pipeline, previews, and the sample preview. Convert-to-code uses the marker. Code designs without it, including old drag-and-drop templates, are unchanged.

  </details>

## 0.10.0

### Minor Changes

- [#161](https://github.com/jshields-ca/LatestArr/pull/161) [`412aeb2`](https://github.com/jshields-ca/LatestArr/commit/412aeb24f8d8bd115cf32ce76e1da52c22229e61) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** The expanded newsletter row is now organized into two clearly labeled panels — Schedule (with its own Delivery subsection) and Content (Template/Sources/Groups) — instead of one long stack of boxes, and the collapsed row's schedule line now highlights the frequency and time instead of reading as one flat muted sentence.

  <details>
  <summary>Technical details</summary>

  Addresses production feedback that the Details tab (`NewsletterDetailsForm`/`NewsletterCard` in `apps/web/src/pages/newsletters-page.tsx`) dumped everything — Name, Schedule, Delivery, Subject template, Template, Sources, Groups — as one flat vertical stack, and that the collapsed row's summary line (e.g. "Weekly on Monday at 8:00 AM (America/Winnipeg) · 7-day lookback") was a single undifferentiated muted string.

  - Added `describeScheduleParts()` (`apps/web/src/lib/schedule.ts`) — same parsing as the existing `formatScheduleForDisplay`, but returns `{ frequency, when, timezone }` separately instead of one sentence, so the collapsed row can render frequency as a `Badge` and the day/time in a bolder weight, with timezone/lookback staying muted.
  - Restructured the expanded Details tab into a `sm:grid-cols-2` layout: the left column is `NewsletterDetailsForm` (Name, then a "Schedule" panel containing the existing `ScheduleField` — cron/advanced toggle unchanged — plus a nested "Delivery" subsection for lookback/SMTP profile/subject template); the right column is a new "Content" panel wrapping the existing `TemplatePicker`/`LinkedSources`/`LinkedGroups` (unchanged behavior — same add-via-dropdown, remove-via-chip pattern). Stacks to one column below `sm`.
  - No functional changes to any picker or the schedule/cron logic — this is a layout and typography pass only.

  </details>

- [#147](https://github.com/jshields-ca/LatestArr/pull/147) [`d2c7c33`](https://github.com/jshields-ca/LatestArr/commit/d2c7c33833d4ab6a2eb802e7270b51a9a83113be) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** Import a Plex or Tautulli source's known users as recipients, grouped together, from the Sources page.

  <details>
  <summary>Technical details</summary>

  `SourceAdapter` (`packages/adapters/core/src/source-adapter.ts`) gains an optional `listUsers?(config): Promise<SourceUser[]>`, the same optional-capability pattern as `fetchPopularItems`/`fetchImageBytes`. Implemented for:

  - **Tautulli**, via its `get_users` API (`getUsers` in `tautulli-client.ts`) — includes each user's `email` when Tautulli has it (synced from the underlying Plex server's shared-user list), filtering out its "Local" pseudo-user (id 0).
  - **Plex**, via the local server's own `/accounts` endpoint (`getAccounts` in `plex-client.ts`) — usernames only, no email. A local server token can't reach plex.tv's own account API, which is the only place a shared user's email is visible; `SourceUser.email` is optional specifically to let a caller (and `NewItem`'s doc comment) handle this per-source gap rather than assuming every source can supply one.

  New `GET /sources/:id/users` (`apps/server/src/http/routes/sources.ts`) 404s (not a 200 with an empty array) when the adapter doesn't implement `listUsers`, so the web UI can tell "unsupported" apart from "zero users right now."

  New "Import users" action on a Plex/Tautulli source row (`apps/web/src/pages/sources-page.tsx`) opens a dialog listing the source's users — pre-checked when they have an email, disabled when they don't (a recipient can't exist without one) — and imports the selected ones via the existing bulk-import endpoint (`POST /recipients/import`, from the CSV/text-paste import feature), then adds each newly-created recipient to a group named after the source, reusing an existing group of that name on a repeat import rather than creating a duplicate.

  </details>

- [#156](https://github.com/jshields-ca/LatestArr/pull/156) [`1ede68a`](https://github.com/jshields-ca/LatestArr/commit/1ede68ab16469567c23ef4ea2d8a572bb9839dff) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** The Logs page now looks and behaves like an actual console — a dense, monospace-font scrolling view instead of separated card panels — and can auto-refresh live instead of requiring a manual Refresh click.

  <details>
  <summary>Technical details</summary>

  Addresses production feedback on the v0.9.0+dev Logs page (`apps/web/src/pages/logs-page.tsx`):

  - Replaced the bordered-card `LogRow` list with a single terminal-style panel (`bg-zinc-950`, `divide-y divide-zinc-900`) where each entry is one line: `HH:MM:SS  LEVEL  message`, level-colored text instead of a badge, expandable inline via a chevron for entries with extra fields (error details, request metadata).
  - Added a JetBrains Mono web font (`index.html`'s existing single Google Fonts request, `--font-mono` in `index.css`'s `@theme inline` block) so the console view and any future code/log surface can reach for `font-mono`.
  - Added a "Live" toggle button that polls `GET /logs` every 3s while enabled (`setInterval` in a `useEffect` keyed on `[live]`, cleared on toggle-off/unmount); polling reuses the existing level filter and refreshes silently (no full-page loading spinner) so it doesn't flicker mid-tail.

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

- [#144](https://github.com/jshields-ca/LatestArr/pull/144) [`85d8768`](https://github.com/jshields-ca/LatestArr/commit/85d87682caa118fd1529873949b81061e7b2d525) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** The dashboard's setup checklist collapses to a thin, full-width bar once setup is complete, positioned above the stat tiles instead of sharing a half-width row with Recent sends — and every dashboard card now uses the same circular icon-chip treatment instead of a mix of bare icons and colored tiles.

  <details>
  <summary>Technical details</summary>

  Two related changes to `apps/web/src/pages/dashboard-page.tsx`:

  - The checklist card and its collapsed "Setup complete" summary were two separately-shaped `Card`s swapped in and out of a two-column grid alongside Recent sends, so the collapsed state still took up as much horizontal room as the full checklist. They're now one `Card` — a single header (icon chip + title + toggle) with conditionally-rendered content — functioning as a real accordion: one row tall when collapsed, positioned in its own full-width row above the stat tiles.
  - Introduced a shared `CardIconChip` component (the circular tinted-background icon treatment the stat tiles already used) and applied it to the checklist header and the Recent sends header too, replacing a bare `CheckCircle2`/no icon at all. Added `emerald` and `tertiary` entries to the accent palette (renamed from `STAT_ACCENTS` to `CARD_ICON_ACCENTS`) for the checklist's "done" state and to match Recent sends' existing tertiary-glass card tint.

  </details>

- [#158](https://github.com/jshields-ca/LatestArr/pull/158) [`c34efa3`](https://github.com/jshields-ca/LatestArr/commit/c34efa3dc27b3ba4facf77811738d8f073e8e8df) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** The Recipients page is now a dense, sortable table with a search box and real pagination — click Name/Email/Status to sort, search narrows results live, and large lists page 25 at a time — instead of one long scrolling list of cards.

  <details>
  <summary>Technical details</summary>

  Addresses production feedback that a real-world recipient list (~50 rows from a Tautulli user import) made `apps/web/src/pages/recipients-page.tsx`'s flat card list hard to navigate. A few layout options were sketched and reviewed before picking this one.

  - Replaced the per-recipient `ListRow` cards with a `<table>` (`RecipientTableRow`), each row: Name, Email, an inline Active/Inactive `Switch`, and Edit/Delete actions.
  - Added click-to-sort column headers (`SortableColumnHeader`) for Name/Email/Status, toggling ascending/descending on repeat clicks, with proper `aria-sort` on each `<th>` and a visible up/down/unsorted icon.
  - Added a client-side search box (`matchesRecipientQuery`) filtering by email or display name, case-insensitive substring match — no API changes, `listRecipients()` still fetches the full list once.
  - Replaced incremental "Show more" with real Previous/Next pagination (`RECIPIENTS_PAGE_SIZE = 25`), resetting to page 1 whenever the search query changes.
  - Header shows a live count ("N recipients" / "N of M match" while searching).

  </details>

- [#171](https://github.com/jshields-ca/LatestArr/pull/171) [`36279f2`](https://github.com/jshields-ca/LatestArr/commit/36279f2c45b6b76623494507c065b68b9d9428f5) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** The "Enabled" toggle no longer takes up a full-width row of its own — it's now folded into the newsletter's header action cluster, alongside Send now and Delete.

  <details>
  <summary>Technical details</summary>

  Closes out the remaining part of [#167](https://github.com/jshields-ca/LatestArr/issues/167) (the button-crowding and Send-now-visibility parts were addressed separately). The toggle was a small control that didn't need a whole `SettingRow` to itself; moved it into `NewsletterCard`'s header `actions` (`apps/web/src/pages/newsletters-page.tsx`) as a compact `<label>`-wrapped `Switch`, and removed the now-empty standalone row.

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

- [#157](https://github.com/jshields-ca/LatestArr/pull/157) [`4997147`](https://github.com/jshields-ca/LatestArr/commit/49971474fd4c0d36421fd8f667807abbe6bb4c13) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** The Dashboard's "Recent sends" card now shows the same expandable send detail as the Newsletters page's History tab — included items, per-recipient delivery status, and a link to view a copy of the sent HTML — instead of just a status line.

  <details>
  <summary>Technical details</summary>

  Addresses production feedback that the enhanced send-run history from the Newsletters page (added in [#137](https://github.com/jshields-ca/LatestArr/issues/137)/[#148](https://github.com/jshields-ca/LatestArr/issues/148)) wasn't reflected on the Dashboard.

  Extracted the newsletters-page's `SendRunHistoryList`/`SendRunDetails` pair into a shared `apps/web/src/components/send-run-history.tsx`, dropping the separate `newsletterId` prop in favor of reading it off `run.newsletterId` (already present on every `SendRun`) so the same list can render runs spanning multiple newsletters. Added an optional `newsletterName` field the Dashboard's cross-newsletter feed populates and the per-newsletter History tab leaves unset. `apps/web/src/pages/newsletters-page.tsx` and `dashboard-page.tsx` both now import from the shared module instead of each keeping their own copy — `dashboard-page.tsx`'s old flat `RecentRunRow` is gone.

  </details>

- [#143](https://github.com/jshields-ca/LatestArr/pull/143) [`038c41d`](https://github.com/jshields-ca/LatestArr/commit/038c41dd8f29fac8f7cab4eb55cdfda8214b69ef) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** The Edit SMTP profile dialog is now split into Connection / Authentication / Sender identity tabs instead of one long scrolling form.

  <details>
  <summary>Technical details</summary>

  Same pattern as the newsletter edit page's Details/History split (`newsletters-page.tsx`) — the Port & encryption group (port field, the always-visible port-convention reference, and the implicit-TLS switch) took up a lot of vertical space on its own, which is what made the dialog feel cramped as a single stacked view. `EditSmtpProfileDialog` in `apps/web/src/pages/smtp-profiles-page.tsx` now wraps Host/Port/encryption, Username/Password, and From name/From email in `Tabs`, with Name staying outside the tabs since it's the profile's own label. The Add SMTP profile dialog is unchanged — it's shorter and wasn't the one reported as cramped.

  </details>

- [#146](https://github.com/jshields-ca/LatestArr/pull/146) [`91e6ad5`](https://github.com/jshields-ca/LatestArr/commit/91e6ad55f87329fd0b4ce833b8dc170565e613b2) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** Bulk-import recipients by pasting a list of emails or uploading a CSV, instead of adding people one at a time.

  <details>
  <summary>Technical details</summary>

  New "Import" button on the Recipients page opens a dialog with a paste area (or an "Upload CSV" button that reads a file's text into the same field). `apps/web/src/lib/recipient-import.ts` parses the pasted/uploaded text tolerating the formats people actually paste: one bare email per line, `email,Name` or `Name,email` CSV-style pairs (either order), `Name <email>` mailto-style entries, and a flat comma/semicolon-separated address list copied straight from a mail client's To field — with a live "N recipients ready to import, M lines couldn't be parsed" preview and the unparseable lines shown before anything is submitted.

  New `POST /recipients/import` (`apps/server/src/http/routes/recipients.ts`) accepts the parsed rows and processes them one at a time rather than as a single multi-row insert, so one bad or duplicate row doesn't fail the whole batch — it returns which rows were `created` and which were `skipped` with a reason (invalid email, already exists, or duplicate within the same import), which the dialog displays after submitting.

  </details>

- [#171](https://github.com/jshields-ca/LatestArr/pull/171) [`36279f2`](https://github.com/jshields-ca/LatestArr/commit/36279f2c45b6b76623494507c065b68b9d9428f5) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Improved:** "Send now" is reachable from a newsletter's collapsed row — no need to expand it first — and no longer sits crowded next to the "Save changes" button.

  <details>
  <summary>Technical details</summary>

  Addresses feedback that Save changes and Send now rendered right next to each other with no clear separation between them, and that Send now was only reachable after expanding a newsletter row.

  Moved the "Send now" button from inside the Details tab into `NewsletterCard`'s always-visible header action cluster (`apps/web/src/pages/newsletters-page.tsx`), alongside Delete. The inline send-result/error feedback moved with it — now rendered right below the Enabled row, outside the `expanded` block, same as Enabled itself, so it shows regardless of whether the row happens to be expanded.

  </details>

- [#148](https://github.com/jshields-ca/LatestArr/pull/148) [`832eebc`](https://github.com/jshields-ca/LatestArr/commit/832eebc286ee6a8116ced59e1ec58a32788f8108) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **New:** Recent Sends history now shows exactly who a send went to and what it included, with a link to the actual rendered copy — not just aggregate counts.

  <details>
  <summary>Technical details</summary>

  `send_runs` gains two columns, set once rendering succeeds (independent of whether individual recipient deliveries later fail): `items_snapshot` (a lightweight `{title, kind}[]` JSON snapshot — the same set `item_count_included` has always counted, now also captured with titles) and `rendered_html` (the actual HTML that was sent, stored verbatim rather than re-rendered on demand, so it reflects exactly what a recipient received even if templates/sources changed since).

  Per-recipient detail already existed in `send_run_recipient_results` (populated by the send pipeline, but never exposed) — new `GET /newsletters/:id/send-runs/:runId/recipients` joins it with `recipients` for each row's email/displayName. New `GET /newsletters/:id/send-runs/:runId/html` serves the stored `rendered_html` directly as `text/html` (a link target, not a JSON-fetched value). The existing list endpoint (`GET /newsletters/:id/send-runs`) explicitly excludes `rendered_html` from each row — it can be tens to hundreds of KB and the list can return many runs at once.

  The newsletter History tab's send-run rows gain a "Details" toggle (only shown when there's something to show) that lazily fetches recipients and renders included-item badges, a per-recipient status list, and a "View a copy of this send" link to the raw HTML endpoint.

  </details>

### Patch Changes

- [#139](https://github.com/jshields-ca/LatestArr/pull/139) [`b6f9680`](https://github.com/jshields-ca/LatestArr/commit/b6f9680f4ccf8c62df78928de65d2e8446637aa0) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** The page footer now stays pinned to the bottom of the browser window on short pages instead of sitting mid-page above empty background.

  <details>
  <summary>Technical details</summary>

  The design-polish-round-2 layout change ([#125](https://github.com/jshields-ca/LatestArr/issues/125)) dropped `flex-1` from the header/sidebar/main content row to fix a different bug — an explicit `h-[calc(100vh-3.5rem)]` height on `aside` was forcing that row to a full viewport height regardless of the footer, causing scroll dead-space on short pages. Removing `flex-1` fixed that but introduced this one: without it, the content row no longer grows to fill leftover space in the `min-h-screen` flex column, so `AppFooter` renders right after short content instead of at the bottom of the viewport.

  Restored `flex-1` on the content row (`apps/web/src/components/app-shell.tsx`) without restoring `aside`'s explicit height — `flex-1` alone (paired with `min-h-screen` on the root) fills exactly the space the header and footer leave, with no explicit-height side effect that would force `100vh` regardless of footer height.

  Also fixed the local dev proxy (`apps/web/vite.config.ts`): `changeOrigin: true` rewrote the outgoing `Host` header to match the API server but left `Origin` as the Vite dev origin, which tripped the server's same-origin CSRF check (`requireSameOrigin`) on every mutating request when running `apps/web` and `apps/server` as separate dev servers. The proxy now rewrites `Origin` to match too.

  </details>

- [#142](https://github.com/jshields-ca/LatestArr/pull/142) [`557dea6`](https://github.com/jshields-ca/LatestArr/commit/557dea6a961c7d00b28a5fa6acdfe5b7d5981c69) Thanks [@jshields-ca](https://github.com/jshields-ca)! - **Fixed:** SMTP profile cards now correctly label STARTTLS connections (e.g. port 587) instead of showing a misleading "No TLS", and give the "Authenticated" badge success styling instead of neutral.

  <details>
  <summary>Technical details</summary>

  The connection-security badge only checked the `secure` boolean (implicit TLS, i.e. port 465), so any STARTTLS profile — the common case for providers like Dreamhost on port 587 — showed "No TLS" even though the connection is encrypted, just via an upgrade after the initial handshake rather than from the start. `connectionSecurityLabel()` in `apps/web/src/pages/smtp-profiles-page.tsx` now also checks `port`, matching the existing `PORT_GUIDE` convention (465 → Implicit TLS, 587 → STARTTLS, anything else → No TLS), and gives both TLS variants `success` badge styling. The "Authenticated" badge also switches from `neutral` to `success` when `hasAuth` is true.

  </details>

## 0.9.0

### Minor Changes

- f630fd5: **Improved:** Editing a newsletter is now a clear Details/History split — Details holds every configuration field (name, schedule, delivery, subject, and now the Template, Sources, and Recipient groups pickers too), and History shows only its send runs.

  <details>
  <summary>Technical details</summary>

  Addresses production feedback that the Template/Sources/Groups pickers lived only in the newsletter row's expanded "accordion" section, separate from the pencil-icon "Edit newsletter" dialog that held name/schedule/lookback/SMTP profile/subject — so a user opening a newsletter to configure it wouldn't find the Template dropdown where they'd expect it, and the accordion looked purely informational.

  Restructures each `NewsletterCard`'s expanded content (`apps/web/src/pages/newsletters-page.tsx`) into a new `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` primitive (`apps/web/src/components/ui/tabs.tsx`, wrapping `@radix-ui/react-tabs` — newly added to `apps/web/package.json`, following the same forwardRef/`cn` wrapping convention as `select.tsx` and `dialog.tsx`) with two tabs: **Details** and **History**. The former "Edit newsletter" dialog is gone — its fields (now `NewsletterDetailsForm`, same `updateNewsletter` call and validation, just rendered inline instead of inside a `Dialog`) live in the Details tab alongside the existing `TemplatePicker`, `LinkedSources`, and `LinkedGroups` components (unchanged). "Send now" stays in Details since it's an action tied to that configuration, not history. History is now just the `SendRunHistoryList`, nothing else. The "Enabled" toggle is untouched by this restructure — it stays on the always-visible collapsed row exactly as before, so it can still be flipped without expanding a newsletter at all. Field ids across the moved-in form are namespaced per newsletter (`newsletter-<id>-name`, etc.) to stay unique with multiple rows expanded at once. Radix's Tabs gives this ARIA `tablist`/`tab`/`tabpanel` roles and roving-focus arrow-key navigation for free, matching the accessibility this app already relies on elsewhere.

  </details>

- 0e4c89a: **New:** Sources now have an optional "Public URL" field, for when a source's own address isn't one you'd want a recipient clicking into — e.g. Tautulli's address is its own API host, not the Plex link people actually want, or a source's address is a Tailscale/LAN address unreachable from outside your network.

  <details>
  <summary>Technical details</summary>

  Adds a "Public URL (optional)" input to both the Add-source and Edit-source dialogs (`apps/web/src/pages/sources-page.tsx`), right under the existing Base URL field, with helper text explaining when a self-hoster would want it: "The address your recipients can actually reach — leave blank to use the address above. Useful when this source's address above is internal-only (e.g. a Tailscale IP or an API host like Tautulli that isn't itself the link you want people to click)." Wired into the same create/update API calls as `baseUrl` (`createSource`/`updateSource` in `apps/web/src/lib/api.ts`); left blank, it's simply omitted on create and clears any previously-set value on update. Server-side support (the `publicUrl` column and its use in building per-item links) ships alongside this in `@latestarr/server`.

  Also makes items in a GrapesJS-authored Media List block (and the composite "All New (This Period)" block, which reuses the same card markup) clickable: `mediaListCardBody` in `apps/web/src/lib/grapesjs-blocks.ts` now wraps an item's title and poster in `<a href="{{externalUrl}}">` when the rendered item has one, styled to inherit the surrounding title color with no underline, falling back to plain text/image when it doesn't — mirroring the same treatment the default (non-custom) newsletter layout got in `@latestarr/server`.

  </details>

### Patch Changes

- f3bc425: **Improved:** Button hovers and the "Star on GitHub" icon now feel smoother and easier to notice at the same time — a longer, gentler light sweep on buttons, and a clear pop-and-glow on the star when you hover it.

  <details>
  <summary>Technical details</summary>

  Addresses production feedback that round 1's button animation was "clunky and abrupt" while the GitHub-star hover was "too subtle" — two different problems, not opposite fixes.

  Buttons: the primary variant's hover lift (`button.tsx`) swaps its bouncy `cubic-bezier(0.34, 1.56, 0.64, 1)` easing (56% overshoot) for a gentle spring, `cubic-bezier(0.22, 1.08, 0.36, 1)` (~8% overshoot) at 240ms — enough life to feel intentional without the bounce that read as jittery on a 2px lift. `.btn-glint`'s light-sweep pseudo-element (`index.css`) gets the same easing swap (a pure ease-out-expo curve, `cubic-bezier(0.22, 1, 0.36, 1)`, since a straight-line translateX sweep has no business overshooting) plus a wider/brighter gradient band (30–70% stops instead of 40–60%, 0.45 alpha instead of 0.35) and a longer 0.85s duration (was 0.6s) so it reads as a deliberate, visible sweep rather than a quick flicker.

  GitHub star (`app-shell.tsx`'s `ProjectInfoCard`): previously just `text-amber-500` → `hover:text-amber-400`. Now a `.star-glow` class scales the star up (`scale(1.22)`) and adds a warm amber `drop-shadow` glow on hover/focus, plus a one-shot `.star-glow-intro` keyframe pulse (scale + glow, ~1.1s, 0.5s after mount, `both` fill mode so it never replays) to catch the eye once on first paint without becoming a nagging loop. Both respect `prefers-reduced-motion` (animations/transitions disabled, falling back to a plain color change).

  </details>

- f3bc425: **Fixed:** On pages with little content, the page footer no longer gets pushed off the bottom of the screen behind a wall of empty space — it now sits right after the content, without needing to scroll to find it.

  <details>
  <summary>Technical details</summary>

  Addresses production feedback that there was "a lot of dead space between the bottom of content and the footer" and that short pages forced a scroll just to reach it. The root cause (`app-shell.tsx`): the content row (`flex-1`, between the sidebar and `<main>`) and the sidebar (`h-[calc(100vh-3.5rem)]`, a viewport-relative fixed height) were both independently forcing that row to be at least one full viewport tall on every page, regardless of how much actual content there was — pushing the footer to just past the fold on every page, not only long ones.

  Fix: drop `flex-1` from the content row and the sidebar's explicit `h-[calc(100vh-3.5rem)]`. The sidebar now sizes via the row's default `align-items: stretch`, so its `border-r` divider still spans the full height of whichever of the sidebar/main is taller on any page with real content — no visual change there. The root `<div>`'s `min-h-screen` is left as-is, so short pages still fill at least one viewport; any leftover space now falls _below_ the footer (ordinary bottom-of-page whitespace) instead of being forced in _above_ it. Verified visually (headless Chromium against the dev build): a minimal page's `document.documentElement.scrollHeight` now equals `window.innerHeight` with no scrollbar, and the footer is visible immediately below the content.

  </details>

- f3bc425: **Improved:** The "LatestArr" wordmark in the header is bigger and plain white/foreground-colored instead of a rose gradient, with "Latest" in bold and "Arr" in a lighter weight for a clearer two-part logo.

  <details>
  <summary>Technical details</summary>

  Addresses production feedback that the wordmark's `bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent` treatment (`logo.tsx`) read as too loud next to the mark, and should instead match how the rest of the header's text behaves. Removes the gradient/clip-text entirely in favor of plain `text-foreground`, bumps the size from `text-xl` to `text-2xl` to hold its own next to the mark without the gradient, and splits the text into two `<span>`s — `font-bold` for "Latest", `font-normal` for "Arr" — for a deliberate two-weight wordmark instead of one uniformly-bold word. The `textClassName` prop (used by the login/setup pages for a smaller variant) still overrides the size via `cn`/tailwind-merge on the wrapping span, which the two inner spans inherit.

  </details>

- f3bc425: **Improved:** The tertiary blue accent now shows up in a few more places — a frosted-glass look on the header's version/GitHub cluster and a couple of secondary info panels, and a distinct blue tint on the footer's attribution links — instead of being limited to just the version badge.

  <details>
  <summary>Technical details</summary>

  Expands the tertiary token (`--tertiary`/`--tertiary-foreground`, see the "Tertiary" note in `index.css`) past its previous badge-only use, per production feedback that it was introduced but under-used. Picked 3 deliberately secondary-info surfaces rather than a global reskin, so it stays an accent, not competing with the rose primary:

  - `ProjectInfoCard` (`app-shell.tsx`, the version/GitHub/Star cluster in both the desktop header and mobile nav sheet): `bg-muted/40` → a translucent tertiary-tinted glass surface (`bg-tertiary/10`, `border-tertiary/25`, `backdrop-blur-sm`), consistent with it sitting inside the already-blurred sticky header.
  - `AppFooter`: a faint `bg-tertiary/[0.03]` wash and `border-tertiary/15` top border, tying the footer visually to the header's glass cluster.
  - Dashboard's "Recent sends" card (`dashboard-page.tsx`): `border-tertiary/20 bg-tertiary/[0.04] backdrop-blur-sm`, since it's a secondary activity-feed panel next to the actionable checklist card, not a primary CTA.

  Footer links (`app-shell.tsx`): the author/license/issue-tracker links move from plain `text-muted-foreground` to a new `footerLinkClassName` using `text-tertiary` (with a dimmed `hover:text-tertiary/75`), the same pattern the app's `link` button variant already uses for `text-primary` — reserved for these three secondary links, not applied to the header's own GitHub icon link, which stays muted so the two clusters don't visually clash.

  </details>

## 0.8.0

### Minor Changes

- 8b65554: **New:** Add a single "All New (This Period)" block to the template editor — drop it into a newsletter and it shows everything added recently, grouped by type (movies, TV episodes, TV seasons, books, audiobooks, games), instead of needing to drag in and configure six separate blocks by hand.

  <details>
  <summary>Technical details</summary>

  Addresses the most common request in production feedback on the Media List blocks: "there isn't any options for 'all new' based on the lookback settings in the Newsletter itself... they would expect all of the latest media (audiobooks, tv shows, movies, books, etc) for that lookback period." Getting that today meant dragging in all six content-kind presets one at a time and turning on each one's "Show all items in the period" trait by hand — this is the same result as one block.

  Dragging in "All New (This Period)" exports one heading + Media List pair per adapter content kind, each reading from the same lookback-scoped `items` pool a per-kind block already does and each already using the existing, shipped `showAll="true"` mechanism (from a previous release's "Show all items in the period" trait) rather than a capped count. A kind with nothing added this period is skipped entirely — heading included, not just its (empty) list — via a new `ifAnyItems` Handlebars block helper (`apps/server/src/render/mjml-template.ts`) that applies the exact same pool + content-type filter `mediaList` itself does, purely to decide whether to render a heading. Without it, a newsletter with e.g. no new games this week would still show a bare "Games" heading over nothing.

  It's registered as its own GrapesJS component type (`media-list-all-new`), not a second implementation of the card markup: the poster+text `<table>` layout and the `{{#mediaList ...}}` hash-argument tag are now both extracted into shared functions (`mediaListCardBody`/`mediaListOpenTag` in `apps/web/src/lib/grapesjs-blocks.ts`) that the standalone Media List block's own `toHTML()` also calls, so the two can't drift apart. Like the standalone block, its canvas preview is a friendly static summary (real per-kind grouping only happens at MJML export time, against real item data at send time) and has no configurable traits — narrowing to one kind is what the existing per-kind presets are for.

  </details>

### Patch Changes

- a386217: **Improved:** Buttons now feel smoother and more premium to hover over — a subtle light sweep and an easier lift, instead of an abrupt bump.

  <details>
  <summary>Technical details</summary>

  Addresses production feedback that the primary button's hover lift felt "bumpy" rather than premium. The hover-triggered lift/shadow now transitions on a slower, spring-like `cubic-bezier(0.34, 1.56, 0.64, 1)` curve at 220ms (up from the shared 150ms linear-ish default), scoped to the `default` variant only via `hover:` utilities so every other button's snappy press-state timing is untouched. A one-shot diagonal light sweep (`.btn-glint` in `index.css`, a `::after` gradient translated across the button and clipped by `overflow-hidden`) plays once per hover-enter rather than looping, and is disabled under `prefers-reduced-motion`.

  </details>

- a386217: **Improved:** The LatestArr logo is more prominent, the version/GitHub/Star links now sit right next to it on mobile too (matching how they already looked on desktop), and the old hidden "About" info icon has been replaced with a real page footer showing the license, the author, and a link to report an issue.

  <details>
  <summary>Technical details</summary>

  Makes the wordmark more prominent (a larger `LogoMark`, larger tracked-out text with a subtle rose gradient fill) and moves the version/GitHub/Star cluster up next to the `Logo` in the mobile nav sheet, matching where it already sits in the desktop header — the two surfaces now read as one consistent design. Removes the sidebar's "About" info-icon popover (author/license/site) entirely and replaces it with a real page footer, visible on every page instead of hidden behind a click: author link, GPLv3 license link, a "Report an issue" link to the GitHub issue tracker, and an "In Active Development" badge.

  </details>

- c5e8616: **Fixed:** Saving a template no longer briefly rebuilds the entire editor canvas behind the scenes (harmless today, but wasteful and a source of subtle glitches down the line).

  <details>
  <summary>Technical details</summary>

  Root-caused while investigating a test that failed intermittently on CI (`template-editor-page.test.tsx`'s "warns on tab close/refresh..." test, "expected true to be false"). Two separate issues, found via instrumented reproduction rather than assumed:

  1. **Real production bug**: `handleSave`'s `setTemplate(updated)` on a successful save gives `template` a new object identity every time. The GrapesJS-init `useEffect` was keyed on `[template]`, so this retriggered it — and a dependency-array change always runs the _previous_ run's cleanup (`editor.destroy()`, `editorRef.current = null`) before the new run's own `editorRef.current` guard is even evaluated, so the guard couldn't prevent it. Every save destroyed and fully reinitialized the GrapesJS editor (confirmed via an instrumented test run: `mockInit` called twice, `destroy` called once, for a single save). Fixed by keying the effect on `Boolean(template)` instead — true exactly once, on the null-to-loaded transition — which matches the effect's actual intent ("initialize once, when data first arrives") without discarding the canvas on every subsequent save. Added a regression assertion (`mockInit`/`mockEditor.destroy` call counts) to the existing save test.

  2. **Real test-helper race** (this was the CI flake's actual cause, confirmed by reproducing it locally — 2 failures in 60 runs before the fix, 0 in 80 after): `simulateEditorContentChange()` fired GrapesJS's mocked content-change handlers immediately after `await screen.findByText("Weekly Digest")` resolved. But `findByText`'s MutationObserver-based resolution isn't guaranteed to happen after _every_ passive effect from the same commit has flushed — the GrapesJS-init effect (which registers the content-change handler at all) is a separate, independently-scheduled effect, so `contentChangeHandlers` could still be empty at that point, making the simulated "edit" a silent no-op. Fixed by having the shared test helper itself wait for a handler to actually be registered before firing it, rather than relying on each call site to remember to check — the same synchronization other tests in this file already used for `mockInit`, just not applied here.

  </details>

- a386217: **Improved:** It's now easier to see which page you're on — the active item in the sidebar gets a clear accent bar, not just a subtle color change.

  <details>
  <summary>Technical details</summary>

  Gives the sidebar/nav-sheet's active nav item a left-edge accent bar (a 3px `bg-primary` pill) on top of its existing background tint, and gives the hover state a slightly slower, clearer background transition — production feedback was that the active state alone was easy to miss at a glance. `navItems` remains a flat list (no section grouping was added, since the current six items don't split into a natural, non-arbitrary category split).

  </details>

- a386217: **Improved:** Added a new accent color (a calm blue) used for informational badges like the version number and the "In Active Development" label, giving the app's look a bit more depth.

  <details>
  <summary>Technical details</summary>

  Adds a third palette hue — `--tertiary`/`--tertiary-foreground` (indigo/blue, hue ~228) — as a genuine design token alongside `--primary`, following production feedback that the "Bloom" palette had nowhere to go for calm, informational UI beyond the rose primary and the ad hoc violet secondary accent. Indigo/blue was picked as the clearest complementary/triadic partner to rose while staying clear of green (already success) and red/orange (already destructive, and Plex's own brand color); both the light and dark pairs clear 4.5:1+ text contrast the same way every other token pair in `index.css` does. Wired into Tailwind as `bg-tertiary`/`text-tertiary-foreground` and exposed as a new `Badge` `tertiary` variant, used for the header's running-version badge and the new footer's "In Active Development" badge — reserved for informational labels, never a semantic success/warning/destructive state.

  </details>

## 0.7.1

### Patch Changes

- 51311b4: Bump eslint (9 → 10) and @eslint/js (9 → 10) across every package, and jsdom (25 → 29.1.1) in apps/web's test environment. Dev-tooling only, no runtime dependency changes.

  The Dependabot PRs for eslint/@eslint/js (#97, #105) failed CI with a stale, out-of-sync pnpm-lock.yaml on their branch — reproduced locally with a freshly regenerated lockfile and confirmed all 40 lint/typecheck/build/test tasks pass cleanly; `eslint-plugin-jsx-a11y`'s declared peer range hasn't caught up to eslint 10 yet, but it lints without error in practice.

  jsdom's own Dependabot PR (#104) proposed 25 → 30, but jsdom 30 dropped Node 20 support entirely (`engines: "^22.22.2 || ^24.15.0 || >=26.0.0"`), which broke this repo's Node 20.x CI job with `TypeError: webidl.util.markAsUncloneable is not a function` — a real Node-runtime incompatibility, not a lockfile issue. Landing on 29.1.1 instead (the latest jsdom release that still supports Node 20.19+) gets most of the version currency without dropping Node 20 CI support, which is a bigger call than a routine dependency bump.

- 23ebd9a: Bump react and react-dom (18 → 19) and their `@types` packages. Dev/runtime dependency only.

  Low migration risk in this codebase: `main.tsx` already uses `ReactDOM.createRoot` (no legacy `ReactDOM.render` to migrate), there's no direct `react-dom/test-utils` import (React 19 moved `act` into `react` itself), and no component uses `defaultProps` on a function component (removed in 19). `@testing-library/react@16` (already in use) and `react-router-dom@7` already support React 19.

  `pnpm turbo run lint typecheck build test` is fully green (40/40 tasks, 225 web tests, no React deprecation warnings in test output). Beyond the test suite, built the app and drove it with a real headless Chromium session against the built server (signup → dashboard → navigated Sources/Recipients/Newsletters/Templates → opened the Add Source dialog) — no console errors, no visual regressions, confirmed by screenshot.

- 73a6d37: Bump vite (6 → 8, apps/web only), vitest (4 → 5, every package), and @vitejs/plugin-react (4 → 6, apps/web only). Dev-tooling only, no runtime dependency changes.

  Bumped all three together since they're an interlocking build/test toolchain — vitest 5 pins a vite 6+ peer, and @vitejs/plugin-react needs to track the vite major it's paired with. `pnpm turbo run lint typecheck build test` is fully green (40/40 tasks, 189 server tests, 225 web tests); no config changes needed in `apps/web/vite.config.ts` or any `vitest.config`.

## 0.7.0

### Minor Changes

- 642ba8b: Design system refresh addressing v0.6.0 production feedback: typography, type hierarchy, visual personality, and consistent save/error feedback across every admin page.

  - **Typography**: adds Plus Jakarta Sans as the app's UI/body face (via `--font-sans`), replacing the unstyled default system-font stack. Newsreader — previously reserved for the "LatestArr" wordmark — now also sets each page's own `<h1>` (a new `PageHeader` component, used on Dashboard, Sources, Recipients, SMTP Profiles, Newsletters, and Templates) at a larger display size, giving the app an actual typographic voice at the one spot per page where it doesn't compete with body text.
  - **Hierarchy**: standardizes the in-page section-label tier (previously plain `text-sm font-medium` — the same weight as plenty of nearby bold body text, e.g. "Template", "Sources", "Recipient groups", "Send history" on the Newsletters page) into a new `SubsectionHeading` component: a small uppercase, tracked-out label distinct from both the page `<h1>` and from bold body copy. Page titles and `<h2>` section headers were already consistent and are unchanged.
  - **Visual personality**: adds violet as a restrained secondary accent (Tailwind's own palette, matching how Badge's success/warning variants and the dashboard's stat tiles already work — no new color tokens) via a new `accent` Badge variant, used on the dashboard's "Optional" checklist tag and a template's "Designed" status. Floating chrome that has real content behind it to blur — Popover, Select, Dialog/Sheet content, and the new toast notifications — gets a translucent, blurred ("glassy") background instead of a flat opaque one; static cards get a faint inset highlight ring for the same read without the wasted compositing cost of blurring nothing. Every button now gets a quick press-down scale on `:active` (previously only the primary variant's hover-lift existed, from the original Bloom rebrand), and the primary button's hover-lift transition now animates only `transform`/`box-shadow`/`background-color`/`color`/`border-color` instead of `transition-all`.
  - **Toasts**: adds a Radix-based toast system (`ui/toast.tsx` + `ui/use-toast.ts` + a `Toaster` mounted once in `App.tsx`, following this codebase's existing Radix-wrapper pattern) and wires it into every save/update/delete/toggle/test/send action across Sources, Recipients, Groups, SMTP Profiles, Newsletters, and Templates — including several actions (the Newsletters template picker, group-member add/remove, the enabled toggle) that previously gave no feedback at all, or reused unrelated inline error state. The template editor's existing inline "Saved" indicator is untouched; it now gets a corresponding toast alongside it rather than being replaced.
  - Reuses the existing `SourceLogo` component on the Newsletters page's linked-source badges, which were missing the per-source-kind icon that the Sources page itself already shows.

  All recolored/retinted surfaces were checked against WCAG AA (4.5:1) in both themes, including the new translucent surfaces at worst-case backdrop extremes.

### Patch Changes

- 5b299e6: Redesign the relationship between the top banner and the sidebar footer, addressing feedback from a production user: the header was mostly dead space (just the theme toggle), the sidebar footer's account email got cut off next to the Edit profile/Sign out buttons, and the Star icon linked straight out to GitHub with no context. The version/GitHub/Star/About cluster and the account summary (name, email, edit, sign out) now live in the desktop header, which has the width to give the email room to stay legible (still truncates gracefully with a `title` tooltip if needed) instead of the cramped 240px sidebar column; the sidebar itself is now just branding-free navigation. The Star icon now opens a small popover — matching the existing About popover's pattern — with a short explanation of why starring helps, and a button that actually links out to GitHub, instead of linking out immediately. The version badge's text is also a size larger while keeping the same mini-card styling. The mobile nav sheet keeps the same compact card layout as before, unchanged.
- f18f469: Addresses the most common piece of v0.6.0 production feedback: newsletters rendering "very plain, no images/posters/covers." Only the RomM adapter ever populated `posterUrl` — Plex, Tautulli, Audiobookshelf, and the BookLore family all left it empty, so their items never got a poster in the default template or a Media List block, even though the rendering side already supported one.

  Wires poster/cover art through for all four remaining adapters: Plex maps its `thumb` field to a token-bearing absolute URL; Tautulli adds the `thumb`/`art` fields its API was already returning but the client wasn't reading, resolved through its own `pms_image_proxy` command; Audiobookshelf maps `media.coverPath` to its token-bearing cover endpoint; and the BookLore-family client gains real OPDS `<link rel="...image">` parsing (preferring the full image over the thumbnail), which it had none of before.

  Rather than putting a source's own URL (frequently LAN-only, and often carrying that source's credentials as a query param) directly into a sent email, a new pipeline step (`apps/server/src/pipeline/embed-images.ts`) fetches each item's image server-side at send time — using the same stored, decrypted credentials the pipeline already polls that source with, via a new `SourceAdapter.fetchImageBytes()` (replacing the previously unimplemented `resolveImageUrl`) — resizes it to a thumbnail with `sharp`, and attaches it to the outgoing email as a Nodemailer CID attachment. The rendered HTML references it with `<img src="cid:...">`; a recipient's mail client never makes an outbound request of its own. This is applied uniformly to the default template and to the GrapesJS Media List block. Every step fails soft, per item: an unreachable source, a failed fetch, or an image `sharp` can't decode falls back to a small blank-pixel data URI for that one item rather than failing the whole send.

  Embedding only ever happens for images a Media List block's own selection (count/order/showAll/emptyFallback) actually renders — real `posterUrl`s are swapped for opaque placeholder tokens before the template renders, and only the tokens that survive into the compiled HTML get fetched, resized, and attached afterward. Otherwise a block showing 5 items out of an 80-item library would fetch, resize, and attach all 80 posters even though only 5 ever appear in the email, undermining the whole "keep message size sane" point of CID embedding. Referenced images are also fetched/resized concurrently rather than one at a time, and the "most watched" and "empty-pool fallback" item pools are fetched concurrently with each other rather than sequentially. Every adapter's image fetch (`fetchImage`/`fetchOpdsImage`) is also now bounded by a 10s `AbortSignal.timeout()` — since `resolvePosterPlaceholders` awaits every referenced item's image via `Promise.all`, one source that hangs instead of erroring would otherwise stall the whole send indefinitely rather than failing that one item's poster softly.

  Also replaces every adapter client's `baseUrl.replace(/\/+$/, "")` trailing-slash trim with a new shared `trimTrailingSlashes()` helper (`@latestarr/adapter-core`) — a plain linear scan instead of a regex CodeQL flagged as a polynomial-time ("catastrophic backtracking") pattern on uncontrolled input.

  Also, from the same feedback:
  - **TV episode titles**: a `tv_episode` item's prominent title was just the bare episode name (e.g. "Winter Is Coming"), with the series name buried in the subtitle — it now leads with the series title, with "SxxExx - Episode Name" as the subtitle, for both Plex and Tautulli. Rendered items also now show a release date alongside the added date when the source provides one.
  - **Content-kind labeling**: BookLore-family items are now labeled "Ebook", "Comic", or "Book" (derived from the OPDS acquisition link's MIME type), and Audiobookshelf items "Audiobook" or "Podcast", surfaced as a small badge next to the title in both the default template and the Media List block — without widening the shared `MediaKind` enum for it.
  - **Smarter Media List blocks**: a new "Random order" trait picks random items from the matching pool instead of always the first N; a new "Show all items in the period" trait removes the count cap entirely; and a new "When nothing matches this period" trait offers a random-items-instead fallback (sampled from an all-time pool, only fetched when a block actually needs it) or a plain link back to the source, instead of silently rendering an empty section.

## 0.6.0

### Minor Changes

- 12df8b1: Newsletter admin fixes from design review and a real send-now test run: newsletter cards now show a human-readable schedule ("Weekly on Monday at 8:00 AM") instead of the raw cron string for schedules the Simple picker can express; the Add newsletter dialog defaults Timezone to the browser's own zone instead of always UTC, and pre-selects the SMTP profile when there's exactly one; the Add/Edit newsletter dialogs group their Schedule and Delivery fields into labeled sections instead of one flat list; a "Send now" that completes with nothing actually sent (no linked source or recipient group) is now visually distinguished from a real send in Send History and on the Dashboard; a genuine send failure (e.g. an unreachable source) now returns a specific, structured error instead of a bare "Internal Server Error", shown inline the moment the send fails; and Send History now refreshes automatically right after a "Send now" click resolves instead of requiring a page reload.
- 5fb2608: Replace the native `<select>` dropdown with a custom-rendered one built on `@radix-ui/react-select`. Every other primitive in the app (Button, Dialog, Switch, Input) is already fully themed, but the browser's own OS dropdown chrome still showed through whenever a Select was opened — bright white on Linux/Windows, breaking out of the app's dark, all-custom aesthetic. The dropdown popover now matches the app's dialogs (same border/shadow/radius/animation language) in both light and dark mode. `Select`'s props are unchanged for every existing call site.

### Patch Changes

- 291d466: Dashboard polish from testing feedback: recent sends now show which newsletter, item/recipient counts, and outcome per entry (reusing the same Send History status logic as the Newsletters page) instead of just a status badge and timestamp; the setup checklist collapses to a small "Setup complete" summary once every required step is done, expandable again to double-check anything, instead of either vanishing or staying full-size forever; the stat tiles (Sources/Recipients/SMTP Profiles/Newsletters) now use per-tile accent-colored icon chips, a hover lift, and a secondary metric where one is meaningful (open sources needing attention, recipient group count, active newsletters); the checklist and Recent sends cards sit side by side on wide screens instead of stacking narrow and leaving the right side of the page empty; and the destructive/warning/success Badge text colors were adjusted to clear WCAG AA contrast against their tinted backgrounds in both themes.
- ac67cff: Expand the template editor's block library beyond the previous three generic blocks (Header, Footer, Media List) so it's actually discoverable: six new "content-kind" preset blocks (Movies, TV episodes, TV seasons, Books, Audiobooks, Games) let a user drag in a ready-to-go section for a specific *arr media kind instead of dragging the generic Media List and then hunting for its Content type trait afterward — each preset is just the existing Media List component with that trait pre-set, not a second implementation. Also add two standard newsletter-builder primitives the library was missing entirely: a Divider (`mj-divider`) and a Spacer (`mj-spacer`). The block panel is now organized under "Layout" (Header, Footer, Divider, Spacer) and "Content" (Media List and its six presets) category headers instead of one flat, unlabeled list.

  Also fixes a real bug surfaced while verifying the new preset blocks against the actual MJML compile pipeline (not just the editor canvas): the Media List component's exported `<table>` markup sat directly under `<mj-column>` with no `<mj-raw>` wrapper, so MJML's compiler silently dropped it (no thrown error under "soft" validation) — meaning the _existing_, already-shipped Media List block rendered its section as empty in a real compiled/sent newsletter despite looking correct in the editor. This affects every content type, not just the new presets, and is fixed alongside them since it shares the same `toHTML()` code.

- 2b050c7: Add a proper "Page not found" screen (with a link back to the Dashboard) for unknown routes, replacing the blank content area you'd get from mistyping a URL like `/smtp-profiles` instead of `/smtp`. Also fix the first-admin signup form only flagging the Password field when submitted empty — Name and Email now get the same red-border-and-inline-message treatment when they're missing too.
- 4aa2379: Restyle the Send History list on the newsletter card so each send-run reads as a distinct, scannable row instead of plain wrapped text: a status icon (matched to the existing badge colors), the timestamp and outcome badge on one line, item/recipient counts and any error message below, all inside a bordered row. Failed and partially-failed sends get a red left accent and tinted background so problems stand out without reading every row. No changes to what data is fetched or when it refreshes.
- 2d6dbc9: Redesign the sidebar's bottom "about" area (version, GitHub links, author, license, site) as a compact bordered mini-card instead of stacked plain text. The version now shows as a small badge, and the "Jeremy Shields · GPLv3 · scootr.ca" attribution moves behind a keyboard-accessible Info popover (built on Radix Popover) so the footer reads as one deliberate row rather than an afterthought, in both the desktop sidebar and the mobile nav sheet.
- b74e7bb: Simplify the SMTP profile Add/Edit dialog's port and encryption copy. Based on direct user testing feedback, the two-sentence paragraph explaining STARTTLS vs. implicit TLS under the "Use implicit TLS" toggle assumed email-server knowledge most self-hosters don't have. It's replaced with a "Port & encryption" section containing a compact, always-visible reference (587 = STARTTLS, 465 = implicit TLS, 25/2525 = usually unencrypted) and a one-line hint under the toggle, both wired up with `aria-describedby` for accessibility. The toggle's behavior (including auto-defaulting on for port 465) is unchanged.
- fcdd37e: Sources page polish from testing feedback: each source kind now shows its service's own logo (Tautulli, Plex, BookLore, BookOrbit, Grimmory, Audiobookshelf, and RomM) next to its kind label in the sources list and in the Add/Edit dialog's Source type picker, bundled locally rather than hotlinked; and the OPDS username/password fields for the BookLore-family sources (BookLore, BookOrbit, Grimmory) now have a plain-language hint explaining that OPDS is just the login for that app's own web reader, not a separate API key.
- 9f184d3: Fix five usability bugs in the template editor: GrapesJS's default panel buttons (Open Blocks, Settings, Layers, etc.) rendered as blank squares because their built-in icons depend on Font Awesome, which this app never loads; the editor's selection/active-state accent showed GrapesJS's own stock orange (from the grapesjs-mjml plugin's custom theme) instead of the app's Bloom pink; clicking the Media List block's preview card selected an inner generic child instead of the block itself, hiding its real Content type/Sort/Number of items traits behind an unlabeled "select parent" step; the Move up/down toolbar buttons rendered as thin unicode arrows next to GrapesJS's bold icons and silently no-opped at the top/bottom of a list with no feedback; and the editor had no unsaved-changes protection at all, so a refresh or the page's own Back button silently discarded in-progress work.
- af3bf57: Consolidate the admin CRUD pages (Sources, Recipients & Groups, SMTP Profiles, Newsletters, Templates) onto a shared `ListRow` component instead of five hand-rolled row layouts that had drifted apart in spacing, hover treatment, and how metadata badges sat next to a row's name. Every row now uses the same leading-icon/primary/secondary/actions shape and the same responsive header layout (stacked on mobile, side-by-side from `sm:` up), so moving between pages no longer shows subtly different row heights or gaps. Also dedupes the identical `ConfirmDelete` inline prompt that Recipients and Templates each defined on their own into a shared `ConfirmDeleteButton`. No page's behavior, click targets, or `aria-label`s changed — this is a visual/structural consolidation only.

  Also gives Recipient Groups an Edit dialog (previously groups could only be added and deleted, so fixing a typo in a group's name meant losing its members by recreating it). It mirrors Recipients' own Edit dialog and reuses the `PATCH /recipient-groups/:id` server route that already existed for it.

## 0.5.0

### Minor Changes

- d5673c5: Give the Media List builder block real poster/cover-art and metadata (runtime, page count, audiobook duration, platform, rating), expand its content-type picker to all six adapter media kinds (movies, TV episodes, TV seasons, books, audiobooks, games), and add real, non-drag Move up/down buttons to every component's toolbar in the template editor.
- dc52fb4: Add a simple Daily/Weekly/Monthly schedule picker (with a raw-cron "Advanced" fallback) and a timezone selector to the newsletter Add/Edit dialogs, plus a new Edit dialog so a newsletter's schedule, lookback window, subject template, and SMTP profile can be changed after creation without recreating it.

### Patch Changes

- d9b6881: Give each source kind a distinct icon on the Sources page and show its friendly label (e.g. "BookOrbit") instead of the raw adapter id (e.g. "bookorbit").

## 0.4.6

### Patch Changes

- d5a8c93: Add a way to edit your own display name and change your password from the admin UI — previously there was no way to do either without direct database access. A new "Edit profile" button next to the sidebar's user info opens a dialog for both; changing the password requires the current password, and accounts that sign in via SSO (no local password) get a clear error if they try.

## 0.4.5

### Patch Changes

- e7f8671: Polish the sidebar's project links: the "view on GitHub" link now uses an actual GitHub mark instead of a generic folder icon, and the star link is a filled, coloured star instead of an outline in the same muted grey as everything else. The scootr.ca globe icon is replaced with a plain attribution line below ("Jeremy Shields · GPLv3 · scootr.ca"), which also corrects an earlier draft that had mislabeled the project's license as AGPL — LatestArr is GPLv3.

## 0.4.4

### Patch Changes

- 1f54bab: Add the ability to edit an existing Recipient, SMTP Profile, or Source connection instead of having to delete and re-create it to fix a typo or rotate a credential. Recipients gain email editing (previously only display name and active/inactive were editable). Sources gain a `PATCH /api/sources/:id` endpoint (previously the only mutations were create/delete/test). Credential fields on Sources and the username/password on SMTP Profiles are never pre-filled (they're not returned decrypted) — leave them blank to keep the stored value, or fill in every credential field for that source kind to replace them all at once.

## 0.4.3

### Patch Changes

- c547058: Fix SMTP connections silently failing with an OpenSSL "wrong version number" error on providers like Dreamhost. The "Use TLS" toggle defaulted on regardless of port, which makes the mailer attempt implicit TLS (wrapping the socket in TLS immediately) — but port 587 (the form's own default) is a STARTTLS port, which expects a plain connection that upgrades to TLS after the initial handshake, not implicit TLS. Sending an implicit-TLS handshake to a STARTTLS-only port fails immediately. The toggle (relabeled "Use implicit TLS (port 465)") now defaults based on the port entered and only overrides that guess once changed manually, and the mailer now sets `requireTLS` when not using implicit TLS so a STARTTLS upgrade failure surfaces as a clear error instead of silently falling back to an unencrypted connection.

  Also fix the Docker container/project name inheriting whatever directory `docker-compose.yml` happens to live in (e.g. `test-latestarr-latestarr-1`) — `docker-compose.yml` now pins its own project and container name to `latestarr` regardless of the checkout's folder name.

## 0.4.2

No changes in this release.

## 0.4.1

No changes in this release.

## 0.4.0

### Minor Changes

- 6c2f604: Make the GrapesJS template builder keyboard-operable. Previously the block panel, layer manager, and every other builder panel button were unreachable by Tab (GrapesJS renders them as plain `<span>`s with no tabindex), and blocks could only be added by dragging — a keyboard-only user had no way to open the builder's panels or add a block to a newsletter layout at all. Panel buttons and blocks are now focusable and Enter/Space-activatable, and every block gets a non-drag "click to add" fallback (appends to the end of the canvas), matching what GrapesJS's own docs recommend for this exact gap.
- a097e99: Add an unauthenticated `GET /api/version` endpoint, and show the running version plus links to the GitHub repo (view + star) and the author's site in the admin sidebar. Also make the docker-compose host port configurable via a `PORT` env var, for anyone whose default `3000` collides with another running service.

## 0.3.0

### Minor Changes

- 69c5e61: Replace the placeholder dashboard with a real setup checklist (connect a source, add recipients/a group, configure SMTP, optionally build a template, create a newsletter), live stats, and recent send history once setup is complete. Added a `docker-compose.yml` and `.env.example` so self-hosters have an actual quick start instead of a bare Dockerfile.

## 0.2.0

### Minor Changes

- 05c9f01: Rebrand from the original teal/cyan accent to "Bloom," a rose accent chosen to stand apart from the blue/teal/purple already common across the self-hosted media ecosystem (and from Plex's own orange). Along with it:

  - The light theme's neutrals move from stark white to a warm, rose-tinted scale, with a softer tinted shadow replacing the previous flat `shadow-sm` on every card, and a hover lift + shadow on primary buttons.
  - Status badges gain an opt-in `dot` prop (a small pulsing indicator, respecting `prefers-reduced-motion`) — used on the Sources screen's "Connected" status, the one genuinely live indicator in the app.
  - The logo mark changes from a double-chevron to an envelope with a spark, reading as "a newsletter just arrived" rather than a generic up-trend glyph.
  - The "LatestArr" wordmark specifically now renders in Newsreader, a serif built for reading/publication contexts, while every other heading and all body/UI text stays on the default sans stack.

- 77623d0: Add the Tailwind v4 + Radix + shadcn-style design system foundation for the admin WebUI: dark-mode-first theme with a teal/cyan brand accent and light-mode toggle, an original logo/favicon, base components (Button, Card, Switch, Input, Label, Separator, Sheet), a reusable settings-row pattern for clear control/label relationships, and a responsive app shell (sidebar nav on desktop, hamburger drawer on mobile) replacing the placeholder UI.
- f253894: Add the admin WebUI's authentication flow: a first-run setup screen to create the initial admin account, a login page (local credentials, plus a "Continue with SSO" option when OIDC is configured), session-aware route protection that redirects unauthenticated visitors to sign in, and a logout control. Adds a small `GET /auth/providers` endpoint so the frontend can detect whether OIDC is enabled and whether the initial admin account has been created yet.
- a55c7cf: Add the drag-and-drop newsletter builder: a GrapesJS-based editor (`/templates/:id/edit`, code-split so its ~700kB isn't shipped to every page) with a curated MJML block set plus a custom block library — Header, Footer, and a dynamic Media List block. Media List is the one genuinely dynamic block: a user configures it entirely through three Traits (Content type, Sort, Count) with no HTML/CSS knowledge required, and it exports as a `{{#mediaList ...}}` Handlebars block helper that the server's render pipeline resolves against real item data at send time — including a "most watched" sort backed by the Tautulli `fetchPopularItems` capability added in an earlier release. The Template API now accepts `compiledMjml` on create/update so the builder's export can be persisted alongside the reusable `designJson` project data.
- 4e26ca7: Add the Newsletters admin screen: create newsletters, toggle enabled, link/unlink sources and recipient groups, trigger a manual send, and view send history — the last of the four Phase 3 admin CRUD screens.
- d19e9e9: Add the Recipients admin screen: manage recipients (add, toggle active/inactive, delete) and recipient groups (add, delete, and manage membership by adding/removing existing recipients), wired to the existing /recipients and /recipient-groups API.
- dbe0fc8: Add the SMTP profiles admin screen: add a profile, test its connection, send a test email, and delete it, wired to the existing /smtp-profiles API.
- d1f0de8: The Sources admin screen no longer hardcodes "Tautulli" as the only connectable source type. It now fetches the list of registered adapter kinds from a new `GET /sources/kinds` endpoint and lets users pick any of them (Tautulli, Plex, BookLore, BookOrbit, Grimmory, Audiobookshelf, RomM), showing the right credential fields (API key, token, or OPDS username/password) for whichever kind is selected.
- 52a8f0c: Add the Sources admin screen: list connections with their status, add a new Tautulli source, test a connection, and delete a source — the first of the Phase 3 admin CRUD screens.
- f90146b: Add a Templates admin screen (list, create, delete) backed by the existing Template CRUD API. Each template shows whether it's been through the drag-and-drop builder yet ("Designed" vs "Not yet designed") — the builder itself, and editing a template's design, lands in a later PR.
- 2b58d0c: Wire newsletters to templates: the Newsletters admin screen now has a Template picker (set at creation, or changed/unset on an existing newsletter) with a direct link into the GrapesJS builder for the linked template. The Newsletter CRUD API accepts `templateId` on create and update (including explicit `null` to unlink). This completes the newsletter builder feature end-to-end — a newsletter can now actually use a custom-designed template for its sends.

### Patch Changes

- c9d59fc: Wire `jest-axe` into the test suite and add automated accessibility checks against every admin page's list, empty, and dialog states, plus Login, Setup, and Dashboard. This caught a real, app-wide issue: `CardTitle` rendered as `<h3>` while every page places it directly under its own `<h1>` with no `<h2>` in between, skipping a heading level. Fixed by rendering `CardTitle` as `<h2>`, which is correct everywhere it's used (a page nesting it under its own `<h2>` section heading just ends up with sibling `<h2>`s, which is still valid).
- 646d74b: Serve the built admin WebUI directly from apps/server in production, so the Docker image is usable end-to-end instead of API-only. Every backend route now lives under `/api` so it can never collide with a client-side route of the same name (e.g. `/sources` the admin page vs. `/sources` the endpoint) now that both are served from one origin.
