---
"@latestarr/server": minor
"@latestarr/web": minor
---

**New:** When a section has more new items than its limit, it ends with how many were left out: "+ 76 more books".

- **Linked** to the source's Public URL when it has one, so people can go and see the rest. Without one it's just the count, rather than a link to an address recipients might not reach.
- **TV** counts shows when a show's episodes are grouped, and episodes when they aren't. Other sections use their own name, including one you've renamed.
- **On by default,** and only shown when something was left out. Turn it off with **Say how many more** under the design's **Sections**.
- **Code designs** can add it with `{{#moreFor}}`, given the same arguments as the `{{#mediaList}}` above it.

Thanks to crispybegs for the idea (#362).

<details>
<summary>Technical details</summary>

Closes #362. A `moreFor` Handlebars helper repeats `mediaList`'s filtering and grouping to count the rows past its `count` (or `MAX_SHOWN_ITEMS`), and renders its block with `{count, label, url}`. `url` comes from a new `publicLinksByContentType` in the render context, built from linked sources' Public URLs only; the existing `sourceLinksByContentType` falls back to a source's own address, which can be an API host. Design settings gain `sections.showMore` (default true). The Default design's rendered email is unchanged unless a section overflows.

Linking to each app's own "recently added" view, suggested on the issue, isn't in this change: it needs checking app by app for a stable address.

</details>
