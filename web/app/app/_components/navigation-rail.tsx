"use client";
import { useState } from "react";
import { Plus, Sun, Moon } from "lucide-react";
import { type NavGroup } from "./nav-config";
import { type Theme } from "./use-theme";
import { RailIcon } from "./rail-icon";

export type RailAccount = { email?: string; isSuperAdmin?: boolean; onSignOut: () => void };

// The wireframe's NavigationRail: BrandArea → Create(+) → primary nav groups → UserDock (theme +
// account). Popovers (create / account) anchor bottom-left off the rail like the design's menu-bl;
// one open at a time, dismissed by a transparent backdrop. `active` = the derived active group id.
export function NavigationRail({ groups, active, onGroup, go, account, theme, toggleTheme }: {
  groups: NavGroup[];
  active: string;
  onGroup: (g: NavGroup) => void;
  go: (section: string) => void;
  account: RailAccount;
  theme: Theme;
  toggleTheme: () => void;
}) {
  const [pop, setPop] = useState<"create" | "account" | null>(null);
  const jump = (s: string) => { setPop(null); go(s); };

  return (
    <nav className="nav-rail" aria-label="Primary">
      <button className="rail-brand" onClick={() => onGroup(groups[0])} title="models" aria-label="models — home">m<b>.</b></button>

      <button className="rail-create" title="Buat baru" aria-label="Buat baru" onClick={() => setPop(pop === "create" ? null : "create")}>
        <Plus size={22} strokeWidth={2} aria-hidden />
      </button>

      <div className="rail-items">
        {groups.map((g) => (
          <button key={g.id} className={`rail-item ${active === g.id ? "on" : ""}`} title={g.label} aria-label={g.label} aria-current={active === g.id ? "page" : undefined} onClick={() => onGroup(g)}>
            <RailIcon icon={g.icon} />
            <span className="rail-lbl">{g.label}</span>
          </button>
        ))}
      </div>

      <div className="rail-dock">
        <button className="rail-item" title={theme === "dark" ? "Tema terang" : "Tema gelap"} aria-label="Ganti tema" onClick={toggleTheme}>
          {theme === "dark" ? <Sun className="rail-ico" size={20} strokeWidth={1.7} aria-hidden /> : <Moon className="rail-ico" size={20} strokeWidth={1.7} aria-hidden />}
        </button>
        <button className={`rail-avatar ${pop === "account" ? "on" : ""}`} title="Akun" aria-label="Akun" onClick={() => setPop(pop === "account" ? null : "account")}>
          {(account.email?.[0] ?? "?").toUpperCase()}
        </button>
      </div>

      {pop && <div className="rail-backdrop" onClick={() => setPop(null)} aria-hidden />}

      {pop === "create" && (
        <div className="rail-pop at-create" role="menu">
          <span className="rail-pop-h">Buat baru</span>
          <button className="rail-pop-item" role="menuitem" onClick={() => jump("chat")}>New chat</button>
          <button className="rail-pop-item" role="menuitem" onClick={() => jump("agents")}>New agent</button>
          <button className="rail-pop-item" role="menuitem" onClick={() => jump("providers")}>Connect provider</button>
        </div>
      )}

      {pop === "account" && (
        <div className="rail-pop" role="menu">
          <span className="rail-pop-h">Akun</span>
          {account.email && <p className="rail-pop-email mono">{account.email}</p>}
          {account.isSuperAdmin && <span className="badge oauth">SUPER</span>}
          <button className="rail-pop-item" role="menuitem" onClick={() => { setPop(null); toggleTheme(); }}>Tema — {theme === "dark" ? "Gelap" : "Terang"}</button>
          <button className="rail-pop-item danger" role="menuitem" onClick={account.onSignOut}>Sign out</button>
        </div>
      )}
    </nav>
  );
}
