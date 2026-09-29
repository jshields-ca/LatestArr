---
"@latestarr/web": patch
---

**Fixed:** The main button on each page now glides up on hover and eases when pressed, instead of jumping into place.

<details>
<summary>Technical details</summary>

- Tailwind v4 compiles `hover:-translate-y-0.5` and `active:scale-[0.98]` to the separate `translate` and `scale` properties, but `button.tsx` only transitioned `transform`.
- The transition list now names `translate` and `scale`, so the lift and press use the intended spring easing. (#240)

</details>
