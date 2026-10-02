// Mirrors apps/server/src/auth/roles.ts. The server enforces roles; the web
// app only hides what someone can't use.
//
// - viewer: reads newsletters, designs, send history, and previews.
// - editor: also manages newsletters (including sending), designs,
//   recipients, and groups.
// - admin: also manages sources, SMTP profiles, notifications, users, and
//   the logs.

export const ROLES = ["viewer", "editor", "admin"] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };

export function hasRole(role: string | undefined, needed: Role): boolean {
  return role !== undefined && role in RANK && RANK[role as Role] >= RANK[needed];
}

export const ROLE_LABELS: Record<Role, string> = {
  viewer: "Viewer",
  editor: "Editor",
  admin: "Admin",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  viewer: "Sees newsletters, designs, and send history. Can't change anything.",
  editor: "Also manages newsletters, designs, and recipients, and can send.",
  admin: "Full access, including sources, SMTP, notifications, users, and logs.",
};
