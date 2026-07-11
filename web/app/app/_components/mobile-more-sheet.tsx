"use client";
import { useEffect } from "react";
import { type NavGroup } from "./nav-config";
import { type RailAccount } from "./navigation-rail";
import { type Theme } from "./use-theme";
import { X } from "lucide-react";
import { RailIcon } from "./rail-icon";

// Overflow bottom sheet for the mobile BottomDock (CareerPack MoreDrawer pattern, plain-CSS: no vaul).
// Lists a quick-create row + every group's sub-sections as tiles, and restores the theme-toggle +
// sign-out affordances the hidden desktop rail otherwise takes away on mobile. Tap → go(id) + close.
const QUICK = [
  { id: "chat", label: "New chat" },
  { id: "agents", label: "New agent" },
  { id: "providers", label: "Connect provider" },
];

export function MobileMoreSheet({ groups, section, go, account, theme, toggleTheme, onClose }: {
  groups: NavGroup[]; section: string; go: (s: string) => void;
  account: RailAccount; theme: Theme; toggleTheme: () => void; onClose: () => void;
}) {
  // lock body scroll + Escape-to-close while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const jump = (s: string) => { onClose(); go(s); };

  return (
    <div className="more-portal" role="dialog" aria-modal="true" aria-label="Semua menu">
      <div className="more-backdrop" onClick={onClose} aria-hidden />
      <div className="more-sheet">
        <span className="more-grab" aria-hidden />
        <div className="more-head">
          <strong>Semua menu</strong>
          <button className="more-x" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        </div>
        <div className="more-scroll">
          <section className="more-grp">
            <div className="more-grp-h">Buat baru</div>
            <div className="more-tiles">
              {QUICK.map((q) => (
                <button key={q.id} className="more-tile" onClick={() => jump(q.id)}>{q.label}</button>
              ))}
            </div>
          </section>
          {groups.map((g) => (
            <section key={g.id} className="more-grp">
              <div className="more-grp-h"><RailIcon icon={g.icon} /> {g.label}</div>
              <div className="more-tiles">
                {g.sections.map((s) => (
                  <button key={s.id} className={`more-tile ${section === s.id ? "on" : ""}`} aria-current={section === s.id ? "page" : undefined} onClick={() => jump(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="more-foot">
          {account.email && <span className="more-acct mono">{account.email}{account.isSuperAdmin ? " · SUPER" : ""}</span>}
          <div className="more-foot-actions">
            <button className="more-fbtn" onClick={toggleTheme}>Tema — {theme === "dark" ? "Gelap" : "Terang"}</button>
            <button className="more-fbtn danger" onClick={account.onSignOut}>Sign out</button>
          </div>
        </div>
      </div>
    </div>
  );
}
