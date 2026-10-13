---
"@latestarr/web": minor
"@latestarr/server": patch
---

**Improved:** Saving works the same way everywhere, so it's always clear whether you need to press Save.

- **Save buttons** for newsletter details, alerts, backup settings, your profile, and editing a source, SMTP profile, group or recipient:
  - the button is enabled only when something has changed, with **Unsaved changes** beside it;
  - **Ctrl+S** (or **Cmd+S**) saves;
  - you're asked before losing changes: on reload, closing the tab, following a sidebar link, closing the dialog, or collapsing the newsletter.
- **Editing a recipient:** name, email and groups all save together with **Save changes**, and **Cancel** asks before discarding. A new group typed there is created when you save, and a name that matches an existing group just adds them to it.
- **Lookback:** an invalid lookback, such as 0 days, now says "Enter a whole number of days, 1 or more." It used to show a raw validation message.

<details>
<summary>Technical details</summary>

- Closes #295. The audit table is on the issue, and the rule is in CONTRIBUTING.md under "Saving".
- **Shared pieces:**
  - `components/ui/save-actions.tsx` (`SaveActions`);
  - `lib/unsaved-changes.ts`: `useUnsavedChanges` (an app-wide registry plus `beforeunload`), `useSavedSnapshot`, `guardClose`, `confirmDiscard`, `saveShortcutRef` and `useSaveShortcut`.
- **`saveShortcutRef`** is a React 19 ref with cleanup rather than `onKeyDown`, which jsx-a11y rejects on a `<form>`. It does nothing while the Save button is disabled.
- **Sidebar links** ask through `confirmDiscard()`. The app uses `BrowserRouter`, so React Router's `useBlocker` isn't available, and the browser's Back button can't be stopped.
- **Server:** `lookbackDays` validation messages are now a plain sentence.

</details>
