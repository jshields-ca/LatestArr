---
"@latestarr/server": patch
---

**Fixed:** An email server that a newsletter sends through can now be deleted. It used to fail with "Something went wrong on the server".

Its newsletters are kept, with no email server chosen. They can't send until you choose another for them, and a scheduled send that fails for that reason raises the usual failure alert.

<details>
<summary>Technical details</summary>

Found while reworking delete confirmations (#332). `newsletters.smtp_profile_id` references `smtp_profiles` with no delete rule and foreign keys are on, so `DELETE /api/smtp-profiles/:id` threw `FOREIGN KEY constraint failed` (a 500) whenever a newsletter used the profile. The route now clears `smtpProfileId` on those newsletters and deletes the profile in one transaction, as deleting a design already does for `templateId`, and logs how many newsletters were left without one. The pipeline and alerts already handled a newsletter with no email server. Regression tests cover an in-use delete and a repeated delete. The other foreign keys without a delete rule (`templates.created_by`, `newsletters.template_id`) were already handled in their routes.

</details>
