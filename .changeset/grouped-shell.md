---
"@latestarr/web": minor
---

**Improved:** A sidebar grouped by job, an account menu, and a clearer header.

- **Grouped sidebar:** Dashboard, then **Send** (Newsletters, Designs, Recipients), **Connect** (Sources, Email servers) and **System** (Notifications, Users, Backups, Logs).
- **"Email servers"** is the new name for the SMTP Profiles page. It works as before.
- **Account menu:** your name in the header opens a menu with Edit profile and Sign out, in place of unlabelled icons.
- **Tidier header and footer:** the version, Docs and GitHub links are at the foot of the sidebar, the page footer is one line, and the logo takes you to the dashboard.
- **Browser tabs are named after the page,** like "Newsletters · LatestArr".
- **Keyboard:** a "Skip to content" link is first on every page.

<details>
<summary>Technical details</summary>

The C2 shell from the UI review (#332). `nav-items.ts` gains `navGroups` and a `group` per item; a group with nothing in it for a role isn't shown. `SidebarFoot` replaces the header's `ProjectInfoCard`, and `AccountMenu` (a popover) replaces the header's name, email and icon buttons; the phone menu keeps `UserSummary` at its foot. `EditProfileDialog` is now opened by its parent, since a dialog inside the menu's popover would close with it. `usePageTitle` (`lib/page-title.ts`) sets `document.title`, called by `PageHeader`, the design editor and the 404 page. The 404 page and the design editor gain an `h1`, `main` is focusable for the skip link, and the footer's maintainer link is underlined. Audit findings 7 and 16, and part of 10. The `/smtp` route, the API and the "SMTP profile" wording inside pages are unchanged.

</details>
