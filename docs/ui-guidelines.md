# UI guidelines

What new interface in `apps/web` is reviewed against. These came out of the UI review in [#332](https://github.com/jshields-ca/LatestArr/issues/332). The brand files and how they're generated are in [`assets/brand/brand.md`](assets/brand/brand.md); the rule for saving is in [CONTRIBUTING.md](../CONTRIBUTING.md#saving).

## Colour

Every colour is a token in `apps/web/src/index.css`, with a light and a dark value. Use the token's utility (`bg-primary`, `text-tertiary`), never a hex value or a stock palette class.

| Colour | Token | Its job |
| --- | --- | --- |
| Rose | `--primary` | The main action on a page, the selected item, and the stamp. |
| Airmail blue | `--tertiary`, `--ring` | Links, information, and keyboard focus. |
| Green, amber, red | `Badge` variants `success`, `warning`, `destructive` | Status only: sent, partly sent, failed. |
| Navy | `--sidebar`, `.surface-navy` | The sidebar and the phone menu, in both themes. |

- **Don't decorate with colour.** A hue that means nothing teaches people to ignore the ones that do.
- **On navy, use `.surface-navy`.** It redefines the semantic tokens for everything inside it, so buttons, badges and muted text need no overrides.
- **Check contrast in both themes:** 4.5:1 for text, 3:1 for field outlines (`--input`) and the focus ring. A tinted row or badge changes the background, so check text on the tint too.

## The stamp and the stripe

- **`LogoMark`** follows the theme: the paper stamp in dark, the rose stamp in light. Pass `variant="paper"` or `"rose"` where the background doesn't follow the theme (it's `paper` on navy), and `variant="muted"` for decoration.
- **`.airmail-stripe`** is the header's bottom edge and the top edge of the signed-out card. Nowhere else, so it stays a signature.
- **The postmark and the stamp's press** belong to the signed-out screens (`AuthCard`).

## Type

Three typefaces, bundled with the app: Plus Jakarta Sans for the interface, Newsreader (`font-brand`) for the wordmark and each page's title only, and JetBrains Mono for logs and code.

## Pages

- **`PageHeader`** gives a page its one `h1` and names the browser tab. A page without one calls `usePageTitle` and has its own `h1`, hidden with `sr-only` if a visible title would repeat something.
- **`AuthCard`** is every signed-out screen: sign-in, setup and the password pages.
- **`EmptyState`** is what a page shows with nothing to list yet: a heading and one line on what to do next.
- **While a page or section loads,** show a placeholder in its shape from `ui/skeleton.tsx` (`ListSkeleton`, `TableSkeleton`, `CardsSkeleton`, `LinesSkeleton`, or `LoadingPlaceholder` with your own bars), so the page doesn't jump when the content arrives. Keep its label ("Loading newsletters..."): that's what a screen reader hears. A spinner is for a short wait inside a button, a dialog or a small panel.
- **The sidebar's sections** are in `lib/nav-items.ts`. A new page goes in Send, Connect or System.

## Actions

- **One primary button per view,** for the action the page is for. Others are `outline`; icon-only buttons are `ghost` with an `aria-label` and a matching `title`.
- **Saving** follows the one rule in [CONTRIBUTING.md](../CONTRIBUTING.md#saving). Where a panel saves by itself beside a form that doesn't, say so in the panel.
- **Deleting** uses `ConfirmDeleteButton` with a `noun` and, where anything else changes, a `consequence`. It asks in a dialog titled with the thing ("Delete Home Plex?") whose button names the action ("Delete source"). Check the consequence against what the server and the database's cascades do.
- **Any other question** uses `confirmAction()`, with a confirm label that names the action.
- **Changing several rows at once** follows the Recipients table: a checkbox per row and one in the heading, and the actions take the search row's place while anything is ticked, so the list doesn't jump and the filter can't change under a selection. One request does the whole change. A change that can be reversed needs no confirmation; a delete asks with the count.
- **Collapsible sections** open with a chevron that turns, and show a summary only while closed.

## Words

- **Say what the thing is,** in the reader's words: "email server", not "SMTP profile". Keep a technical term where it's what people type or look up ("SMTP host").
- **A button says what it does:** "Delete source", "Send now". Not "Confirm" or "OK".
- **A label that shows a state says the state it's in:** "Scheduled" or "Paused", "Active" or "Inactive".
- **Dates** go through `DateTime` or `lib/dates.ts`: no seconds, the viewer's locale, and the exact time on hover. Logs keep their own second-level times.
- **Sentence case** for headings, buttons and labels.

## Accessibility

- **Targets are at least 24px** tall and wide. Pad a small control; don't shrink the gap around it.
- **Focus is always visible,** in blue. Don't remove a focus ring; restyle it with `focus-visible:ring-2 focus-visible:ring-ring`.
- **After a dialog closes, focus goes back** to what opened it. `confirmAction()` does this by itself.
- **Name form sections** with `role="group"` and `aria-labelledby` on their `SubsectionHeading`, or a `fieldset` and `legend`.
- **A control's name includes its visible text.** Don't cover it with a different `aria-label`.
- **Decoration is hidden** from screen readers with `aria-hidden`.
- **Motion plays once and stops,** and is switched off under `prefers-reduced-motion`. The exceptions are a spinner and a loading placeholder's pulse, which run only while something is loading; the pulse also stops under reduced motion.

## Before opening a PR

1. Look at the change in both themes.
2. Look at it at phone width (390px). The page must not scroll sideways.
3. Use it with the keyboard alone.
4. Give a new page or shared component an axe test, as the existing ones have.
