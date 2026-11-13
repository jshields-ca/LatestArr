---
"@latestarr/web": patch
---

**Improved:** Deleting anything now asks the same way, in a dialog that names it and says what goes with it.

- The dialog asks "Delete Home Plex?", says what else changes ("Newsletters that use it will stop including its items."), and its button says what it does: **Delete source**, not "Confirm".
- It's the same for newsletters, designs, recipients, groups, sources, email servers, users and backups. Before, the row's buttons were swapped for "Delete? Confirm / Cancel", in three slightly different versions.
- Keyboard users are put back where they were when any confirmation closes. Focus used to jump to the top of the page.

<details>
<summary>Technical details</summary>

Audit finding 6 from the UI review (#332). `ConfirmDeleteButton` (`components/list-row.tsx`) now calls `confirmAction()` and takes `noun` and an optional `consequence`; the inline prompt is gone, along with the hand-rolled copies and their `confirmingDelete` state on the Sources, Newsletters and Email servers pages. The dialog is an `alertdialog` with Cancel focused first. `ConfirmHost` records the focused element when a question is asked and restores it in `onCloseAutoFocus`, falling back to `#main-content` when that element is gone or disabled (the row just deleted); this also fixes focus after the unsaved-changes and unlink-SSO confirmations. Each consequence was checked against the schema's cascades.

</details>
