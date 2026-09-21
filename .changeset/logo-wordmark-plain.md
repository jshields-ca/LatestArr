---
"@latestarr/web": patch
---

**Improved:** The "LatestArr" wordmark in the header is bigger and plain white/foreground-colored instead of a rose gradient, with "Latest" in bold and "Arr" in a lighter weight for a clearer two-part logo.

<details>
<summary>Technical details</summary>

Addresses production feedback that the wordmark's `bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent` treatment (`logo.tsx`) read as too loud next to the mark, and should instead match how the rest of the header's text behaves. Removes the gradient/clip-text entirely in favor of plain `text-foreground`, bumps the size from `text-xl` to `text-2xl` to hold its own next to the mark without the gradient, and splits the text into two `<span>`s — `font-bold` for "Latest", `font-normal` for "Arr" — for a deliberate two-weight wordmark instead of one uniformly-bold word. The `textClassName` prop (used by the login/setup pages for a smaller variant) still overrides the size via `cn`/tailwind-merge on the wrapping span, which the two inner spans inherit.

</details>
