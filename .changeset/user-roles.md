---
"@latestarr/server": minor
"@latestarr/web": minor
---

**New:** Users can now be admins, editors, or viewers. Viewers see newsletters, designs, previews, and send history without being able to change anything. Editors can also create and send newsletters, edit designs, and manage recipients. Admins can do everything, including sources, SMTP, notifications, users, and logs. Choose a role when you add someone, or change it from the Users page. Existing users stay admins.

<details>
<summary>Technical details</summary>

- Closes #257. Roles are enforced on the server: `requireAuth(db, { read, write })` gives each route group the role it needs for `GET` and for changes, and a route can ask for a different one with `config: { minRole }` (previews are open to viewers; `GET /sources/:id/libraries` and `/users`, recipient lists, and a send's recipient results need an editor).
- A refused request answers `403` with `code: "role_required"` and the role needed, and is logged.
- `security.test.ts` lists every signed-in route with the role it needs, fails when a new route isn't listed, and checks each route against all three roles.
- `POST /users` takes a `role` (default `viewer`) and `PATCH /users/:id` can change it. Admins can't change their own role, and the last active admin can't be demoted, deactivated, or deleted. Role changes apply on the next request.
- The web app hides the pages and controls a role can't use: the sidebar is filtered, admin-only pages show a "No access" card, newsletters and designs are read-only for viewers (a disabled `fieldset`, and a read-only code editor), and pages only fetch what the role can read.
- The SMTP Profiles page is admin-only; editors still get the profile list for choosing one on a newsletter.

</details>
