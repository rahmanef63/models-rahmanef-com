"use client";
import { type ReactNode } from "react";
import { type NavGroup, groupOfSection } from "./nav-config";
import { NavigationRail, type RailAccount } from "./navigation-rail";
import { BottomDock } from "./bottom-dock";
import { type Theme } from "./use-theme";

// The single outer chrome (rr: exactly one shell). Ports the wireframe's AppShell — NavigationRail
// (icon rail) + SecondarySidebar (sub-sections of the active group) + MainRegion + optional docked
// RightPanel (aiDock). `section` is the single source of truth; the active rail group is derived
// from it, so rail clicks, sidebar clicks and in-content `go()` all route through the same setter.
export function DashboardShell({ groups, section, go, isAdmin, account, theme, toggleTheme, workspaceSwitcher, aiDock, onCompose, bleed, secondaryPanel, children }: {
  groups: NavGroup[];
  section: string;
  go: (s: string) => void;
  isAdmin: boolean;
  account: RailAccount;
  theme: Theme;
  toggleTheme: () => void;
  workspaceSwitcher: ReactNode;
  aiDock?: ReactNode;
  onCompose: () => void; // mobile FAB → open the AI compose sheet (the mobile equivalent of the docked composer)
  bleed?: boolean; // full-bleed, full-height content (no region padding) — e.g. the memory graph
  secondaryPanel?: ReactNode; // extra secondary-sidebar content below the section list — e.g. the vault tree
  children: ReactNode;
}) {
  const activeGroup = groupOfSection(section, isAdmin);
  return (
    <div className="dash-shell">
      <NavigationRail
        groups={groups}
        active={activeGroup.id}
        onGroup={(g) => go(g.sections[0].id)}
        go={go}
        account={account}
        theme={theme}
        toggleTheme={toggleTheme}
      />
      <div className="dash-body">
        <aside className="sec-sidebar" aria-label={activeGroup.label}>
          <div className="sec-head">{workspaceSwitcher}</div>
          <div className="sec-group-label">{activeGroup.label}</div>
          <div className="sec-items">
            {activeGroup.sections.map((s) => (
              <button key={s.id} className={`sec-item ${section === s.id ? "on" : ""}`} aria-current={section === s.id ? "page" : undefined} onClick={() => go(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
          {secondaryPanel}
        </aside>
        <main className={`dash-region ${bleed ? "bleed" : ""}`}>{children}</main>
        {aiDock}
      </div>
      <BottomDock groups={groups} section={section} go={go} isAdmin={isAdmin} account={account} theme={theme} toggleTheme={toggleTheme} onCompose={onCompose} />
    </div>
  );
}
