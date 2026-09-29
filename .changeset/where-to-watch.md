---
"@latestarr/server": minor
"@latestarr/web": minor
---

**New:** Newsletters can now show where to watch. Designs add a button for each linked source that has a public URL, such as **Watch on Plex**, **Read on BookLore** or **Play on RomM**. You choose where the buttons go: after the items, under each section, or near the top. You can also place your own buttons above the intro, below it, or at the end.

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
