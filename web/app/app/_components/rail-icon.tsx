// Shared 24×24 stroke-icon renderer for a nav-config ICONS path `d`. Used by both the desktop
// NavigationRail and the mobile BottomDock so the SVG wrapper isn't duplicated.
export function RailIcon({ d }: { d: string }) {
  return (
    <svg className="rail-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
