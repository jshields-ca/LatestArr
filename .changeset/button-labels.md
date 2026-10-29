---
"@latestarr/web": patch
---

**Fixed:** The design editor makes clear which buttons each colour and style changes.

- **Where to watch** says its buttons have their own style, outlined at first, and that the Browse link follows it. The **Style** under **Your buttons** only changes buttons you add.
- **Button text** says "Not used: every button is outlined" when it has no effect, because an outlined button uses Button colour for its text and border.
- The colour note ends with the fix most people want: set the Where to watch Style to **Filled**.

Nothing about how emails look has changed.

<details>
<summary>Technical details</summary>

`AccentColours` takes an `unused` map shown in place of a colour's value. Button text counts as used when your buttons are filled, or the Where to watch style is filled (it also styles the Browse link). Fixes #394.

</details>
