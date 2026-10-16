---
"@latestarr/adapter-core": patch
"@latestarr/adapter-plex": patch
"@latestarr/adapter-tautulli": patch
"@latestarr/adapter-booklore-family": patch
"@latestarr/web": patch
---

**Fixed:** Book and Plex links in newsletters open the right item, BookOrbit audiobooks show as audiobooks, and the OPDS sign-in hint is corrected.

- **BookOrbit, BookLore and Grimmory links:** a book now links to its own page, at your Public URL. Before, every book linked to the library's front page, because these apps' feeds don't include a link to each book.
- **BookOrbit audiobooks:** an item whose files are all audio now shows as an **Audiobook**, under Audiobooks, instead of as a book. A book with both an ebook and its audio stays a book, labelled **Ebook + audio**. MOBI, AZW3 and FB2 books now show as **Ebook**, and CB7 comics as **Comic**, instead of just "Book".
- **Plex links on app.plex.tv:** with `https://app.plex.tv` as the Public URL, links now use Plex's own `/desktop/` address. Some browsers, especially those in email apps, lost the item when Plex redirected the old link, and showed the Plex home page instead.
- **OPDS hint:** BookLore, BookOrbit and Grimmory use separate OPDS accounts, not your normal sign-in. The hint now says so, and where to create one. It used to say to use your normal sign-in.

<details>
<summary>Technical details</summary>

- **`booklore-client.ts`:** `getEntryBookId` reads `urn:booklore:book:<id>` and `urn:bookorbit:book:<id>`, and `isAudiobookEntry` is true when every acquisition link has an `audio/*` type. `getEntryFormatLabel` recognises the MIME types BookOrbit serves for MOBI, AZW and AZW3, FB2 and CB7, and adds " + audio" when an item also has audio files. BookOrbit serves `.m4b` as `audio/mp4` and `.mp3` as `audio/mpeg`.
- **`booklore-adapter.ts`:** links are chosen in this order: `rel="alternate"`, then `/book/<id>` (the route in all three apps), then `rel="self"`, then the library root. `supportsMediaKinds` is now `["book", "audiobook"]`, and `mediaKinds` filters each item. The app always saves an empty filter, so existing newsletters keep their audiobooks.
- **`adapter-core`:** a new `plexWebAppUrl` returns `https://app.plex.tv/desktop/` for app.plex.tv, and `<url>/web/index.html` otherwise. `buildPlexWebDeepLink` and the Plex and Tautulli fallback links use it.
- Reported in #353.

</details>
