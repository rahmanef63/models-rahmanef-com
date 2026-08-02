// Two-tier dashboard navigation, ported from the Design-Platform wireframe's NavigationRail +
// SecondarySidebar. The 18 flat sections collapse into 6 icon-rail groups; picking a group swaps
// the secondary sidebar to its sub-sections. `sectionId` values MUST stay in sync with the switch
// in section-router.tsx. Pure data export — exempt from the 200-line cap.

import { Home, Sparkles, Plug, Activity, Brain, Users, ShieldCheck, type LucideIcon } from "lucide-react";

export type NavSection = { id: string; label: string };
export type NavGroup = { id: string; label: string; icon: LucideIcon; sections: NavSection[] };

const GROUPS: NavGroup[] = [
  { id: "home", label: "Home", icon: Home, sections: [{ id: "overview", label: "Overview" }] },
  {
    id: "studio",
    label: "Studio",
    icon: Sparkles,
    sections: [
      { id: "chat", label: "Workbench" },
      { id: "agents", label: "Agents" },
      { id: "combos", label: "Combos" },
    ],
  },
  {
    id: "connect",
    label: "Connect",
    icon: Plug,
    sections: [
      { id: "providers", label: "Providers" },
      { id: "mcp", label: "MCP Server" },
      { id: "mcp-servers", label: "MCP Clients" },
      { id: "channels", label: "Channels" },
      { id: "embed", label: "Embed" },
      { id: "api", label: "API Keys" },
    ],
  },
  {
    id: "ops",
    label: "Operate",
    icon: Activity,
    sections: [
      { id: "usage", label: "Usage" },
      { id: "workspace-usage", label: "Billing" },
      { id: "budget", label: "Budget" },
      { id: "schedules", label: "Schedules" },
      { id: "audit", label: "Audit" },
    ],
  },
  {
    id: "memory",
    label: "Memory",
    icon: Brain,
    sections: [
      { id: "notes", label: "Vault" },
      { id: "knowledge", label: "Knowledge" },
      { id: "graph", label: "Graph" },
      { id: "memory", label: "Facts" },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    icon: Users,
    sections: [
      { id: "members", label: "Members" },
      { id: "settings", label: "Settings" },
    ],
  },
];

const ADMIN_GROUP: NavGroup = {
  id: "admin",
  label: "Admin",
  icon: ShieldCheck,
  sections: [
    { id: "admin", label: "Admin" },
    { id: "analytics", label: "Analytics" },
    { id: "traffic", label: "Traffic" },
    { id: "seed", label: "Seed" },
  ],
};

export function groupsFor(isAdmin: boolean): NavGroup[] {
  return isAdmin ? [...GROUPS, ADMIN_GROUP] : GROUPS;
}

// which rail group owns a given section id — drives the active-rail highlight + deep-link restore.
export function groupOfSection(sectionId: string, isAdmin: boolean): NavGroup {
  const all = groupsFor(isAdmin);
  return all.find((g) => g.sections.some((s) => s.id === sectionId)) ?? all[0];
}
