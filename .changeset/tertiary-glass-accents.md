---
"@latestarr/web": patch
---

**Improved:** The tertiary blue accent now shows up in a few more places — a frosted-glass look on the header's version/GitHub cluster and a couple of secondary info panels, and a distinct blue tint on the footer's attribution links — instead of being limited to just the version badge.

<details>
<summary>Technical details</summary>

Expands the tertiary token (`--tertiary`/`--tertiary-foreground`, see the "Tertiary" note in `index.css`) past its previous badge-only use, per production feedback that it was introduced but under-used. Picked 3 deliberately secondary-info surfaces rather than a global reskin, so it stays an accent, not competing with the rose primary:

- `ProjectInfoCard` (`app-shell.tsx`, the version/GitHub/Star cluster in both the desktop header and mobile nav sheet): `bg-muted/40` → a translucent tertiary-tinted glass surface (`bg-tertiary/10`, `border-tertiary/25`, `backdrop-blur-sm`), consistent with it sitting inside the already-blurred sticky header.
- `AppFooter`: a faint `bg-tertiary/[0.03]` wash and `border-tertiary/15` top border, tying the footer visually to the header's glass cluster.
- Dashboard's "Recent sends" card (`dashboard-page.tsx`): `border-tertiary/20 bg-tertiary/[0.04] backdrop-blur-sm`, since it's a secondary activity-feed panel next to the actionable checklist card, not a primary CTA.

Footer links (`app-shell.tsx`): the author/license/issue-tracker links move from plain `text-muted-foreground` to a new `footerLinkClassName` using `text-tertiary` (with a dimmed `hover:text-tertiary/75`), the same pattern the app's `link` button variant already uses for `text-primary` — reserved for these three secondary links, not applied to the header's own GitHub icon link, which stays muted so the two clusters don't visually clash.

</details>
