---
"@latestarr/server": minor
"@latestarr/web": minor
"@latestarr/db": minor
---

**New:** Add your logo to the top of a design, under **Logo** in the design editor.

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
