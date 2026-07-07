// Two-tier dashboard navigation, ported from the Design-Platform wireframe's NavigationRail +
// SecondarySidebar. The 18 flat sections collapse into 6 icon-rail groups; picking a group swaps
// the secondary sidebar to its sub-sections. `sectionId` values MUST stay in sync with the switch
// in section-router.tsx. Pure data export — exempt from the 200-line cap.

export type NavSection = { id: string; label: string };
export type NavGroup = { id: string; label: string; icon: string; sections: NavSection[] };

// simple geometric line glyphs (24×24, stroke) — matches the wireframe's "no elaborate SVG" rule.
export const ICONS: Record<string, string> = {
  home: "M3 10.5 12 4l9 6.5M5.5 9.5V20h13V9.5",
  studio: "M12 3.5l2.1 6.1 6.4.1-5.1 3.9 1.9 6.1L12 16l-5.2 3.7 1.9-6.1-5.1-3.9 6.4-.1z",
  connect: "M8 12a2 2 0 1 0-4 0 2 2 0 1 0 4 0M20 12a2 2 0 1 0-4 0 2 2 0 1 0 4 0M8 12h8",
  ops: "M3 12h3.5l2.5-7 4 14 2.5-7H21",
  workspace: "M12 3.2l7.5 4.4v8.8L12 20.8l-7.5-4.4V7.6z",
  admin: "M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z",
  create: "M12 5v14M5 12h14",
};

const GROUPS: NavGroup[] = [
  { id: "home", label: "Home", icon: ICONS.home, sections: [{ id: "overview", label: "Overview" }] },
  {
    id: "studio",
    label: "Studio",
    icon: ICONS.studio,
    sections: [
      { id: "chat", label: "Workbench" },
      { id: "agents", label: "Agents" },
      { id: "combos", label: "Combos" },
    ],
  },
  {
    id: "connect",
    label: "Connect",
    icon: ICONS.connect,
    sections: [
      { id: "providers", label: "Providers" },
      { id: "mcp", label: "MCP Server" },
      { id: "mcp-servers", label: "MCP Clients" },
      { id: "channels", label: "Channels" },
      { id: "api", label: "API Keys" },
    ],
  },
  {
    id: "ops",
    label: "Operate",
    icon: ICONS.ops,
    sections: [
      { id: "usage", label: "Usage" },
      { id: "workspace-usage", label: "Billing" },
      { id: "budget", label: "Budget" },
      { id: "schedules", label: "Schedules" },
      { id: "audit", label: "Audit" },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    icon: ICONS.workspace,
    sections: [
      { id: "graph", label: "Memory Graph" },
      { id: "members", label: "Members" },
      { id: "memory", label: "Memory" },
      { id: "settings", label: "Settings" },
    ],
  },
];

const ADMIN_GROUP: NavGroup = {
  id: "admin",
  label: "Admin",
  icon: ICONS.admin,
  sections: [{ id: "admin", label: "Admin" }],
};

export function groupsFor(isAdmin: boolean): NavGroup[] {
  return isAdmin ? [...GROUPS, ADMIN_GROUP] : GROUPS;
}

// which rail group owns a given section id — drives the active-rail highlight + deep-link restore.
export function groupOfSection(sectionId: string, isAdmin: boolean): NavGroup {
  const all = groupsFor(isAdmin);
  return all.find((g) => g.sections.some((s) => s.id === sectionId)) ?? all[0];
}
