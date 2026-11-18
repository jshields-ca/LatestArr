---
"@latestarr/web": minor
"@latestarr/server": minor
---

**Improved:** More of LatestArr's envelope look.

- **The stamp in the header** sits at the same slight tilt as on the sign-in screen.
- **Dialogs** have the airmail stripe along their top edge.
- **Buttons for the main action** have a darker edge under them, like the stamp's, and press down onto it.
- **Send started and Test sent** show the stamp and a postmark.
- **Designs** can top the newsletter with an airmail stripe: in the design editor, under **Colours and font**, set **Top edge** to **Airmail stripe**. It uses your accent colour and airmail blue. Existing designs keep their solid line.

<details>
<summary>Technical details</summary>

Approved options from the #332 review.

- **Design setting:** `topEdge: "solid" | "airmail"` (default `solid`). The airmail stripe is a row of table cells in the accent and `#2f5fb8`, not a CSS gradient, because email apps don't draw gradients reliably. Its dashes are straight, and the card's rounded corners clip it where the email app supports that. It sits directly in the card's `mj-wrapper`: inside a column, MJML would put it in a `<tbody>`, and browsers move a table out of there.
- **Toasts:** a `sent` variant shows the stamp and postmark lines in place of the tick, hidden from screen readers. The stamp presses on once and stays still with reduced motion.
- **Buttons:** the `default` variant uses `--primary-edge` and translates on press. It replaces the hover lift and light sweep (`.btn-glint`, removed).
- **Dialogs:** `DialogContent` adds `.airmail-stripe` along its top. `docs/ui-guidelines.md` now says where the stripe and the stamp's press belong.

</details>
