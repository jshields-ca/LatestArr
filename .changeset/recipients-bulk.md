---
"@latestarr/web": minor
"@latestarr/server": minor
---

**New:** On the Recipients page, see who is in which group, and change several people at once.

- **Groups in the table:** each person's groups show beside their email, and a menu next to the search box narrows the list to one group, or to people in no group.
- **Tick several people:** a box on each row, one in the heading for the whole page, and **Select all** for everyone who matches the search and group filter.
- **Change them together:** make them active or inactive, add them to a group, remove them from one, or delete them. Delete asks first and says how many.
- **One line on the Logs page** for each change, saying how many people it changed and naming them.

Deleting someone, alone or with others, now also says that they'll go from the list of who past sends went to. That was already the case; the message didn't mention it.

<details>
<summary>Technical details</summary>

Audit finding 13 from the UI review (#332) and #400. `GET /api/recipients` also returns `memberships` (`{ recipientId, groupId }` pairs), so the table shows and filters by group without a request per person. `POST /api/recipients/bulk` takes `{ action, ids, groupId? }` with `action` one of `activate`, `deactivate`, `addToGroup`, `removeFromGroup` or `delete`, up to 5,000 ids, and needs the editor role like the single-recipient routes. It runs in one transaction, skips ids that don't exist, and answers `{ changed, requested }`, where `changed` counts only the people it altered. Its log entry names up to 25 addresses.

In the web app the actions replace the search row while anyone is ticked, so the search and filter can't change under a selection; from 1024px up the table doesn't move when the first box is ticked. The Groups column shows from 1280px, and under the name below that.

</details>
