import type { ReactNode } from "react";

// What a code design can use. Mirrors the render context and helpers in
// apps/server/src/render/mjml-template.ts; keep the two in sync.

function Entry({ code, children }: { code: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <code className="w-fit rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">{code}</code>
      <span className="text-xs text-muted-foreground">{children}</span>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </div>
  );
}

export function DesignCodeReference() {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-xs text-muted-foreground">
        Everything is escaped, so item text can&apos;t break your markup. HTML that isn&apos;t an MJML tag goes inside{" "}
        <code className="font-mono">&lt;mj-raw&gt;</code>. The{" "}
        <code className="font-mono">latestarr:dark-mode</code> comment in the head adds this design&apos;s dark-mode
        colours when it&apos;s sent; delete it to leave them out.
      </p>

      <Group title="Newsletter">
        <Entry code="{{newsletterName}}">The newsletter&apos;s name.</Entry>
        <Entry code="{{lookbackDays}}">How many days back this issue looks.</Entry>
        <Entry code="{{generatedAtFormatted}}">The send date, e.g. September 27, 2026.</Entry>
        <Entry code="{{periodFormatted}} {{itemCount}}">The date range covered, e.g. Sep 21 – 28, 2026, and how many items are new.</Entry>
        <Entry code="{{#each kindCounts}}{{this}}{{/each}}">A count per type, largest first, e.g. 23 episodes, 9 movies.</Entry>
        <Entry code="{{introText}} {{footerNote}}">From Text and buttons above; empty when not set.</Entry>
        <Entry code="{{#each ctas}}{{label}} {{url}}{{/each}}">The buttons from Text and buttons.</Entry>
      </Group>

      <Group title="Items">
        <Entry code="{{#each items}}...{{/each}}">
          Everything new in the lookback window. <code className="font-mono">{"{{#if items.length}}"}</code> checks
          for any.
        </Entry>
        <Entry code="{{title}} {{subtitle}} {{overview}}">Name, episode or author line, and summary.</Entry>
        <Entry code="{{overviewShort}}">The summary cut to about two lines.</Entry>
        <Entry code="{{contentLabel}} {{kind}}">
          Badge text (Movie, Ebook, ...) and type: movie, tv_episode, tv_season, book, audiobook, or game.
        </Entry>
        <Entry code="{{posterUrl}} {{externalUrl}}">Poster or cover image, and a link to the item.</Entry>
        <Entry code="{{addedAtFormatted}} {{releaseDateFormatted}}">When it was added and released.</Entry>
        <Entry code="{{genres}} {{rating}} {{runtimeFormatted}}">Genres, rating like 8.1/10, and runtime like 1h 45m.</Entry>
        <Entry code="{{pageCount}} {{durationFormatted}} {{platform}}">Book pages, audiobook length, game platform.</Entry>
        <Entry code="{{detailsLine}}">
          Runtime, pages, length, or platform, then rating, e.g. 1h 52m · 7.8/10. Empty when there are none.
        </Entry>
        <Entry code="{{episodeCount}} {{#each episodes}}{{subtitle}}{{/each}} {{moreEpisodes}}">
          On a row standing for several episodes of one show (groupEpisodes): how many, up to five of them with
          their subtitle and externalUrl, and how many more weren&apos;t listed.
        </Entry>
        <Entry code="{{isFallback}}">True for a library pick shown because nothing new was added.</Entry>
      </Group>

      <Group title="Helpers">
        <Entry code={'{{#mediaList contentType="movie" sort="added" count="5"}}...{{/mediaList}}'}>
          Like each, filtered and trimmed. sort: added or mostWatched. order: sequential or random. showAll=&quot;true&quot;
          ignores count. emptyFallback: none, link (with fallbackLinkLabel), or random (with fallbackCount).
          groupEpisodes=&quot;true&quot; folds a show&apos;s new episodes into one row. contentType can list several
          types, e.g. &quot;tv_episode,tv_season&quot;.
        </Entry>
        <Entry code={'{{#ifAnyItems contentType="book"}}...{{else}}...{{/ifAnyItems}}'}>
          Whether that type (and sort) has anything to show, e.g. to hide a heading.
        </Entry>
        <Entry code={'{{#ifKindLinked contentType="game"}}...{{/ifKindLinked}}'}>
          Whether one of the newsletter&apos;s sources provides that type.
        </Entry>
      </Group>
    </div>
  );
}
