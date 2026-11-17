---
"@latestarr/server": patch
"@latestarr/web": patch
---

**Fixed:** Importing recipients no longer changes anyone already on your list. Before, importing a source's users renamed existing recipients to their username, and a file renamed anyone whose name in it was different.

- **From a source:** people already on your list are marked **Already on your list** and can't be ticked. The import leaves them as they are.
- **From a file:** the review asks first. When some names in the file differ, tick **Use the names in the file** to use them. Otherwise everyone keeps the name they have. A file's groups still add people already on your list to those groups.
- **Dialogs** no longer run off the right edge when a name or email is long.

<details>
<summary>Technical details</summary>

Closes #452. Both imports already matched emails ignoring case, so nobody was ever added twice. The problem was renaming. The source import sends each user's username as `displayName`, and `plan()` in `recipient-import.ts` renamed any existing recipient whose `displayName` differed.

- **Server:** `POST /api/recipients/import` takes `updateNames` (off by default). Without it, a differing name leaves the person in `unchanged` instead of `update`. The plan gains `nameDifferences`, the count the review uses to offer renaming. Undo is unchanged; it only reverses renames that happened.
- **Source dialog:** loads the recipients when it opens and leaves existing emails out of the selection, including emails typed in for users the source has none for. If the recipients can't be loaded, no one is marked, and the server still renames no one.
- **File dialog:** the review asks the server again when the checkbox changes, so what it shows is what Import does. The done step says "Renamed" and only when something was.
- **Dialog layout:** `DialogContent` is a grid whose single column grew to fit the widest unbreakable text, so long usernames or emails pushed the whole dialog's content past its right edge. It's now `grid-cols-[minmax(0,1fr)]`, which fixes every dialog.

Regression tests: names are kept by default (server); people already on the list aren't picked or sent, including by a typed email (Sources page); and the review offers renaming and sends `updateNames` only when it's ticked (Recipients page).

</details>
