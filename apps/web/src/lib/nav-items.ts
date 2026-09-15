import {
  LayoutDashboard,
  Server,
  Users,
  Mail,
  Send,
  LayoutTemplate,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sources", label: "Sources", icon: Server },
  { to: "/recipients", label: "Recipients", icon: Users },
  { to: "/smtp", label: "SMTP Profiles", icon: Mail },
  { to: "/newsletters", label: "Newsletters", icon: Send },
  { to: "/templates", label: "Templates", icon: LayoutTemplate },
];
