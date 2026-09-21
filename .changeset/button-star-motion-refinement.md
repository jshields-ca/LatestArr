---
"@latestarr/web": patch
---

**Improved:** Button hovers and the "Star on GitHub" icon now feel smoother and easier to notice at the same time — a longer, gentler light sweep on buttons, and a clear pop-and-glow on the star when you hover it.

<details>
<summary>Technical details</summary>

Addresses production feedback that round 1's button animation was "clunky and abrupt" while the GitHub-star hover was "too subtle" — two different problems, not opposite fixes.

Buttons: the primary variant's hover lift (`button.tsx`) swaps its bouncy `cubic-bezier(0.34, 1.56, 0.64, 1)` easing (56% overshoot) for a gentle spring, `cubic-bezier(0.22, 1.08, 0.36, 1)` (~8% overshoot) at 240ms — enough life to feel intentional without the bounce that read as jittery on a 2px lift. `.btn-glint`'s light-sweep pseudo-element (`index.css`) gets the same easing swap (a pure ease-out-expo curve, `cubic-bezier(0.22, 1, 0.36, 1)`, since a straight-line translateX sweep has no business overshooting) plus a wider/brighter gradient band (30–70% stops instead of 40–60%, 0.45 alpha instead of 0.35) and a longer 0.85s duration (was 0.6s) so it reads as a deliberate, visible sweep rather than a quick flicker.

GitHub star (`app-shell.tsx`'s `ProjectInfoCard`): previously just `text-amber-500` → `hover:text-amber-400`. Now a `.star-glow` class scales the star up (`scale(1.22)`) and adds a warm amber `drop-shadow` glow on hover/focus, plus a one-shot `.star-glow-intro` keyframe pulse (scale + glow, ~1.1s, 0.5s after mount, `both` fill mode so it never replays) to catch the eye once on first paint without becoming a nagging loop. Both respect `prefers-reduced-motion` (animations/transitions disabled, falling back to a plain color change).

</details>
