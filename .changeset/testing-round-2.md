---
"@latestarr/web": patch
---

**Improved:** Confirmations in LatestArr's own style, and a clearer import summary.

- **Confirmations in the app's own style:** discarding unsaved changes, **Undo last import**, **Edit as code**, and **Unlink SSO** now ask in a LatestArr dialog instead of the browser's plain prompt. Each button says what it does, like **Discard** or **Undo import**.
- **Clearer import summary:** after an import you see the counts (Added, Updated, Group memberships, Groups created, Skipped) and a separate note about **Undo last import**.
- **Tidier More colours:** the design editor's extra colours are one per row, so long names like "Label background" no longer wrap.

<details>
<summary>Technical details</summary>

- From release testing in #281.
- **`components/confirm-dialog.tsx`:** `confirmAction(options)` returns a promise, and one `<ConfirmHost />` is mounted in `App`. Both work like toasts, through a module-level store. With no host mounted, a confirm stays unanswered, which counts as Cancel.
- **`lib/unsaved-changes.ts`:** `confirmDiscard()` is now async, `askToDiscard()` is new, and `guardClose` closes once the user discards. Sidebar links prevent navigation, ask, then navigate.
- **`EditRecipientDialog`:** keeps `{ memberIds, newGroups }` against the saved ids, and on Save it updates the details, creates groups, and adds then removes memberships. After a partial failure it reloads their groups.
- **CONTRIBUTING.md "Saving":** everything in a form waits for its Save, and confirmations use `confirmAction`, never `window.confirm`.

</details>
