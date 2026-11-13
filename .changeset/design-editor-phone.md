---
"@latestarr/web": patch
---

**Improved:** The design editor works on a phone: a switch at the top shows either the options or the preview.

- Before, the preview sat below every option, a long scroll away. Now **Options** and **Preview** are one tap apart, and the switch stays at the top as you scroll.
- Each view keeps its place. Check the preview, switch back, and you're at the option you were editing.
- On a wider screen, where both fit side by side, nothing changes, except that the preview's controls no longer slide under the header when you scroll.

<details>
<summary>Technical details</summary>

Audit finding 12 from the UI review (#332). `NarrowViewSwitch` in `design-editor-page.tsx` is shown below `lg` (1024px), so it covers tablets held upright too; it's a pair of `aria-pressed` buttons, labelled "Code" in place of "Options" for a code design. The column not chosen is `hidden lg:flex`, and each view's `window.scrollY` is kept in a ref and restored on switching. The preview keeps updating while hidden. The preview column's sticky offset is now `calc(3.5rem + 3px + 1rem)`, below the app header and its stripe; `top-4` had put its "Preview with" row underneath the header once the page scrolled.

</details>
