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

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** The role needed to see this page (see lib/roles.ts). */
  minRole: Role;
}

export const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, minRole: "viewer" },
  { to: "/sources", label: "Sources", icon: Server, minRole: "viewer" },
  { to: "/recipients", label: "Recipients", icon: Users, minRole: "editor" },
  { to: "/smtp", label: "SMTP Profiles", icon: Mail, minRole: "admin" },
  { to: "/newsletters", label: "Newsletters", icon: Send, minRole: "viewer" },
  { to: "/designs", label: "Designs", icon: Palette, minRole: "viewer" },
  { to: "/notifications", label: "Notifications", icon: BellRing, minRole: "admin" },
  { to: "/users", label: "Users", icon: UserCog, minRole: "admin" },
  { to: "/backups", label: "Backups", icon: DatabaseBackup, minRole: "admin" },
  { to: "/logs", label: "Logs", icon: ScrollText, minRole: "admin" },
];
