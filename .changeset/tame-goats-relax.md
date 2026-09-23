---
"@latestarr/web": minor
"@latestarr/server": minor
---

**Fixed:** The Recipients table's Name column no longer reads as cramped against the left border.

**New:** The Edit recipient dialog now lets you add or remove group membership — and create a brand-new group — without leaving the dialog.

<details>
<summary>Technical details</summary>

- `apps/web/src/pages/recipients-page.tsx`: the Name `<td>` was missing the left padding its `<th>` had (`px-4` vs `pr-4`-only), so header text sat indented while row text sat flush against the border.
- Added `GET /recipients/:id/groups` (`apps/server/src/http/routes/recipients.ts`) — the reverse of the existing `GET /recipient-groups/:id`'s `members`, so a recipient-centric UI doesn't need to fetch every group's member list to figure out which ones a given recipient is already in.
- Added `RecipientGroupsField` to `EditRecipientDialog`, mirroring the Newsletters page's `LinkedGroups` pattern (add-via-dropdown, remove-via-chip) plus an inline "create a new group" shortcut that creates and adds in one action. Reuses the existing `POST/DELETE /recipient-groups/:id/members` endpoints — no new mutation endpoints needed.

</details>
