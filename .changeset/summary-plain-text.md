---
"@latestarr/server": patch
---

**Fixed:** Summaries show as plain words in the newsletter. A summary saved with formatting, as Audiobookshelf often does, no longer shows its formatting code as text.

<details>
<summary>Technical details</summary>

Closes #461, reported in #244 with Audiobookshelf 2.37.2. A summary that contains HTML tags or entities is turned into plain text (`summaryText()` in `render/plain-text.ts`) before it's shortened and rendered. This happens once, where every source's summary is prepared for the email, because Jellyfin, Emby and OPDS can send HTML too. Paragraphs and line breaks become single spaces, entities become characters, links keep only their text, and images are dropped. A summary with no markup is left exactly as it was. The text is still escaped when it's rendered.

</details>
