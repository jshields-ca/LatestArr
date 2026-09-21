---
"@latestarr/server": patch
---

**Fixed:** Every item in a sent newsletter now shows a small badge naming what it is — "Movie", "TV Episode", "TV Season", "Game", "Book", or "Audiobook". Previously only Ebooks, Comics, Audiobooks and Podcasts (from BookLore-family and Audiobookshelf) got a badge; movies, TV episodes, TV seasons and games showed no badge at all.

<details>
<summary>Technical details</summary>

The badge markup in both the default template (`apps/server/src/render/newsletter-template.ts`) and the GrapesJS-authored one (`apps/web/src/lib/grapesjs-blocks.ts`'s `CONTENT_LABEL_BADGE`) has always rendered `{{contentLabel}}`, an optional, adapter-set free-text field on `NewItem` — only BookLore-family and Audiobookshelf ever set it (to distinguish Ebook/Comic within "book" or Audiobook/Podcast within "audiobook"). The `kind` field itself (movie/tv_episode/tv_season/book/audiobook/game) was never mapped to a display label anywhere in the render path.

Rather than duplicating a label map in both consumers, the fallback is resolved once, upstream of both: `apps/server/src/render/mjml-template.ts`'s `toRenderable()` (the single function both the default and custom/GrapesJS-authored templates' items pass through before either ever sees them) now resolves `contentLabel` via a new `KIND_LABELS` map when the adapter didn't set one, so `RenderableItem.contentLabel` is always populated. Both templates already just read `{{contentLabel}}`, so neither needed any change — `grapesjs-blocks.ts`'s badge markup works unmodified. An adapter-set `contentLabel` (Comic, Podcast, etc.) still takes priority over the kind fallback.

</details>
