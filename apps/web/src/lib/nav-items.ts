import {
  LayoutDashboard,
  Server,
  Users,
  Mail,
  Send,
  Palette,
  ScrollText,
  BellRing,
  DatabaseBackup,
  UserCog,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/lib/roles";

/** The sidebar's sections, in order (#332). Dashboard sits above them. */
export const navGroups = ["Send", "Connect", "System"] as const;
export type NavGroup = (typeof navGroups)[number];

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** The section this page is listed under; none for Dashboard. */
  group?: NavGroup;
  /** The role needed to see this page (see lib/roles.ts). */
  minRole: Role;
}

// What you do every week comes first (Send), then what it runs on
// (Connect), then upkeep (System).
export const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, minRole: "viewer" },
  { to: "/newsletters", label: "Newsletters", icon: Send, minRole: "viewer", group: "Send" },
  { to: "/designs", label: "Designs", icon: Palette, minRole: "viewer", group: "Send" },
  { to: "/recipients", label: "Recipients", icon: Users, minRole: "editor", group: "Send" },
  { to: "/sources", label: "Sources", icon: Server, minRole: "viewer", group: "Connect" },
  { to: "/smtp", label: "Email servers", icon: Mail, minRole: "admin", group: "Connect" },
  { to: "/notifications", label: "Notifications", icon: BellRing, minRole: "admin", group: "System" },
  { to: "/users", label: "Users", icon: UserCog, minRole: "admin", group: "System" },
  { to: "/backups", label: "Backups", icon: DatabaseBackup, minRole: "admin", group: "System" },
  { to: "/logs", label: "Logs", icon: ScrollText, minRole: "admin", group: "System" },
];
