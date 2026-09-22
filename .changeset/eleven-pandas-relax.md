---
"@latestarr/web": minor
---

**Improved:** The Logs page now looks and behaves like an actual console — a dense, monospace-font scrolling view instead of separated card panels — and can auto-refresh live instead of requiring a manual Refresh click.

<details>
<summary>Technical details</summary>

Addresses production feedback on the v0.9.0+dev Logs page (`apps/web/src/pages/logs-page.tsx`):

- Replaced the bordered-card `LogRow` list with a single terminal-style panel (`bg-zinc-950`, `divide-y divide-zinc-900`) where each entry is one line: `HH:MM:SS  LEVEL  message`, level-colored text instead of a badge, expandable inline via a chevron for entries with extra fields (error details, request metadata).
- Added a JetBrains Mono web font (`index.html`'s existing single Google Fonts request, `--font-mono` in `index.css`'s `@theme inline` block) so the console view and any future code/log surface can reach for `font-mono`.
- Added a "Live" toggle button that polls `GET /logs` every 3s while enabled (`setInterval` in a `useEffect` keyed on `[live]`, cleared on toggle-off/unmount); polling reuses the existing level filter and refreshes silently (no full-page loading spinner) so it doesn't flicker mid-tail.

</details>
