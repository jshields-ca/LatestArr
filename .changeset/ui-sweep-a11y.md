---
"@latestarr/web": patch
---

**Improved:** Small fixes from a last pass over every page before 0.13.0.

- **A page's main button stays top right** on a wide screen, even when its description is long (as on Designs).
- **Icon-only buttons show what they do** when you hover over them, like Edit on sources, email servers, recipients and groups.
- **Screen readers and voice control:** the account button's name includes your role, the account and **From a source** menus have names, and the "No access" page has its own heading and tab title.
- **Importing users,** a Plex account with no name is listed as "Unnamed user" with its number, instead of a blank row.

<details>
<summary>Technical details</summary>

Findings 1–4, 6 and 7 of #473 (axe: `label-content-name-mismatch`, `aria-dialog-name`, `page-has-heading-one`, `label`). `PageHeader`'s text block is `flex-1 basis-72`. "Back to Dashboard" is "Back to dashboard" on the no-access and not-found pages. The **File format** disclosure in Import recipients responds across its whole band.

</details>
