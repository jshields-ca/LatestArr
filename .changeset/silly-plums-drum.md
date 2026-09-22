---
"@latestarr/web": minor
---

**Improved:** The dashboard's setup checklist collapses to a thin, full-width bar once setup is complete, positioned above the stat tiles instead of sharing a half-width row with Recent sends — and every dashboard card now uses the same circular icon-chip treatment instead of a mix of bare icons and colored tiles.

<details>
<summary>Technical details</summary>

Two related changes to `apps/web/src/pages/dashboard-page.tsx`:

- The checklist card and its collapsed "Setup complete" summary were two separately-shaped `Card`s swapped in and out of a two-column grid alongside Recent sends, so the collapsed state still took up as much horizontal room as the full checklist. They're now one `Card` — a single header (icon chip + title + toggle) with conditionally-rendered content — functioning as a real accordion: one row tall when collapsed, positioned in its own full-width row above the stat tiles.
- Introduced a shared `CardIconChip` component (the circular tinted-background icon treatment the stat tiles already used) and applied it to the checklist header and the Recent sends header too, replacing a bare `CheckCircle2`/no icon at all. Added `emerald` and `tertiary` entries to the accent palette (renamed from `STAT_ACCENTS` to `CARD_ICON_ACCENTS`) for the checklist's "done" state and to match Recent sends' existing tertiary-glass card tint.

</details>
