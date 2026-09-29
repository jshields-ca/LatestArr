---
"@latestarr/server": minor
"@latestarr/web": minor
"@latestarr/db": minor
---

**New:** More than one person can manage LatestArr. The new **Users** page lets you add people with a temporary password, which they replace with their own the first time they sign in. You can also reset passwords, deactivate or reactivate accounts, and delete users. Everyone has full admin access for now. With SSO set up, add someone with the email their provider uses, and they can sign in with SSO straight away.

**Fixed:** Deactivating an account now signs it out immediately; before, an open session kept working until it expired. Sign-in email addresses are no longer case-sensitive.

<details>
<summary>Technical details</summary>

Closes #227.

- Server: `GET/POST /users` and `PATCH/DELETE /users/:id`, admin-only. Users can't deactivate or delete themselves, and a last-active-admin check is kept as a safeguard. Deleting a user clears `templates.createdBy` and keeps the design. Deactivating or resetting a password ends that user's sessions (`deleteUserSessions`). Changes are logged with who made them.
- Migration `0008_user_management` adds `users.must_change_password`, set on accounts created or reset by an admin. `PATCH /auth/me` clears it on a password change, refuses reusing the current password, and ends the user's other sessions.
- `getSessionUser` rejects sessions of deactivated users. Login matches email case-insensitively.
- OIDC links a new SSO identity to an existing active account with the same email when `email_verified` is true. It still never creates accounts once one exists.
- Web: a Users page (nav item, `/users`) with add, reset-password, deactivate, and delete; `ProtectedRoute` shows a "Choose a new password" screen while `mustChangePassword` is set. The self-hosting guide gains a Users section and notes on SSO linking.
- The `role` column already allows editor and viewer. Enforcing those roles is a follow-up.

</details>
