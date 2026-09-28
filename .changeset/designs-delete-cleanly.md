---
"@latestarr/server": minor
"@latestarr/web": minor
---

**Fixed:** Deleting a design that a newsletter uses no longer fails with an error. Those newsletters switch back to the Default design, and the Designs page now shows which newsletters use each design and says so before you confirm.

<details>
<summary>Technical details</summary>

`DELETE /templates/:id` failed with `SQLITE_CONSTRAINT_FOREIGNKEY` whenever a newsletter referenced the design. It now clears those newsletters' `templateId` and deletes the design in one transaction, logging which newsletters changed. `ConfirmDeleteButton` takes an optional `prompt`.

</details>
