"use client";
import { useState } from "react";
import { Sparkles, Menu } from "lucide-react";
import { type NavGroup, groupOfSection } from "./nav-config";
import { type RailAccount } from "./navigation-rail";
import { type Theme } from "./use-theme";
import { RailIcon } from "./rail-icon";
import { MobileMoreSheet } from "./mobile-more-sheet";

// Mobile bottom-nav dock (CareerPack pattern): 3 primary group tabs + a center AI FAB + a "More"
// overflow sheet. Shown only ≤640px via globals.css; desktop keeps the icon rail. Every tap routes
// through the same `go`/section state the rail uses — active state derived, no parallel tab state.

export function BottomDock({ groups, section, go, isAdmin, account, theme, toggleTheme, onCompose }: {
  groups: NavGroup[]; section: string; go: (s: string) => void; isAdmin: boolean;
  account: RailAccount; theme: Theme; toggleTheme: () => void; onCompose: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const active = groupOfSection(section, isAdmin).id;
  const primary = groups.slice(0, 3);

  const Tab = ({ g }: { g: NavGroup }) => (
    <button className={`bd-item ${active === g.id ? "on" : ""}`} aria-current={active === g.id ? "page" : undefined} aria-label={g.label} onClick={() => go(g.sections[0].id)}>
      <span className="bd-ico"><RailIcon icon={g.icon} /></span>
      <span className="bd-lbl">{g.label}</span>
    </button>
  );

  return (
    <>
      <nav className="bottom-dock" aria-label="Primary (mobile)">
        {primary.slice(0, 2).map((g) => <Tab key={g.id} g={g} />)}
        <button className="bd-fab" aria-label="Asisten AI — tulis prompt" onClick={onCompose}>
          <Sparkles size={22} strokeWidth={1.9} aria-hidden />
        </button>
        {primary[2] && <Tab g={primary[2]} />}
        <button className={`bd-item ${moreOpen ? "on" : ""}`} aria-label="Lainnya" aria-expanded={moreOpen} aria-haspopup="dialog" onClick={() => setMoreOpen(true)}>
          <span className="bd-ico"><Menu size={20} strokeWidth={1.7} aria-hidden /></span>
          <span className="bd-lbl">Lainnya</span>
        </button>
      </nav>
      {moreOpen && <MobileMoreSheet groups={groups} section={section} go={go} account={account} theme={theme} toggleTheme={toggleTheme} onClose={() => setMoreOpen(false)} />}
    </>
  );
}
