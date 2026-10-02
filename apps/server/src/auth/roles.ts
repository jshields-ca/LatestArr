// What each role can do (docs/self-hosting.md "Users" has the user-facing
// version):
//
// - viewer: reads newsletters, designs, send history, and previews. Can't
//   see recipients' email addresses or change anything.
// - editor: also manages newsletters (including sending), designs,
//   recipients, and groups.
// - admin: also manages sources, SMTP profiles, notifications, users, and
//   the logs.
//
// Each route group declares the role it needs to read and to change
// things (see requireAuth), and a route can ask for a different role with
// `config: { minRole }`.

export const ROLES = ["viewer", "editor", "admin"] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };

export function hasRole(role: Role, needed: Role): boolean {
  return RANK[role] >= RANK[needed];
}

export const ROLE_LABELS: Record<Role, string> = {
  viewer: "Viewer",
  editor: "Editor",
  admin: "Admin",
};
