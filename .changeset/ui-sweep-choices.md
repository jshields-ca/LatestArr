---
"@latestarr/web": patch
---

**Improved:** Importing users from Plex, Tautulli and other sources lets you choose the group, and a few things look the same everywhere.

- **The group is your choice.** Pick **Don't add to a group**, one of your groups, or **New group…** (named after the source to start with, as before). Typing the name of a group you already have adds them to it, whatever its capitals, instead of making a second one.
- **Dialogs on a phone** end in a full-width main button, whether you're adding something or saving changes.
- **Edit and Delete stay together** on Sources and Email servers, so Delete is never left on a line of its own on a phone.
- **On Recipients,** Add group is outlined, so Add recipient is the page's one main button.

<details>
<summary>Technical details</summary>

Closes #472; findings 8–10 of #473. `SaveActions` with `align="end"` (dialogs only) stacks `flex-col-reverse` below `sm`, like `DialogFooter`. The import dialog's group is a `Select` of `none`, `group:<id>` or `new`; group names match ignoring case and surrounding spaces, as the file import's do.

</details>
