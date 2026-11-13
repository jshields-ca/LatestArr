---
"@latestarr/web": patch
---

**Improved:** While a page loads, it shows grey bars in the shape of what's coming, in place of a spinner and a line of text.

- **Less jumping:** the placeholder takes up the room the content will, so the page moves less when it arrives. The Dashboard keeps its title and layout from the start.
- **No flash on a fast connection:** the bars wait a fifth of a second before showing, so a page that loads straight away never shows them.
- **Where:** the Dashboard, Newsletters, Designs, Recipients, Sources, Email servers, Notifications, Users, Backups, Logs, the design editor and a newsletter's send history. Short waits inside buttons and dialogs keep their spinner.

<details>
<summary>Technical details</summary>

Audit finding 17 from the UI review (#332), the last of its 17. `components/ui/skeleton.tsx` has `Skeleton` (one bar), `LoadingPlaceholder` (a `role="status"` wrapper whose label is read to screen readers while the bars are `aria-hidden`), and the shapes `ListSkeleton`, `TableSkeleton`, `CardsSkeleton` and `LinesSkeleton`. The bars pulse with `motion-safe:animate-pulse`, so they hold still under `prefers-reduced-motion`. `.placeholder-in` in `index.css` delays and fades the placeholder in; under reduced motion it keeps the delay and drops the fade. `docs/ui-guidelines.md` says when to use a placeholder and when a spinner.

</details>
