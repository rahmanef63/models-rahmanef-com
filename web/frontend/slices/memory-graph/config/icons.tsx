import { type ReactElement } from "react";

// Simple geometric line glyphs (24×24, currentColor). Cluster/type icons resolve by node.icon or
// node.type; UI icons are referenced by name in the chrome. Kept dependency-free (no icon lib).
const svg = (children: ReactElement | ReactElement[]) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export const ICONS: Record<string, ReactElement> = {
  // cluster / node-type icons
  memory: svg([
    <circle key="c" cx="12" cy="12" r="2" />,
    <ellipse key="a" cx="12" cy="12" rx="9" ry="4" />,
    <ellipse key="b" cx="12" cy="12" rx="9" ry="4" transform="rotate(60 12 12)" />,
    <ellipse key="d" cx="12" cy="12" rx="9" ry="4" transform="rotate(120 12 12)" />,
  ]),
  agent: svg([
    <rect key="r" x="5.5" y="8" width="13" height="10" rx="3" />,
    <path key="a" d="M12 4.5v3.5" />,
    <circle key="t" cx="12" cy="3.5" r="1" />,
    <path key="e" d="M9.5 12.5v1M14.5 12.5v1" />,
  ]),
  skill: svg(<path d="M12 3l1.9 5.4L19 10l-5.1 1.6L12 17l-1.9-5.4L5 10l5.1-1.6z" />),
  tool: svg(<path d="M15.5 4.2a4 4 0 0 0-5.2 5.2l-6 6 2.1 2.1 6-6a4 4 0 0 0 5.2-5.2l-2.4 2.4-2-2z" />),
  // UI glyphs
  import: svg([<path key="a" d="M12 3v12m0 0 4-4m-4 4-4-4" />, <path key="b" d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />]),
  controls: svg([<path key="a" d="M4 7h16" />, <path key="b" d="M8 12h8" />, <path key="c" d="M10 17h4" />]),
  search: svg([<circle key="c" cx="11" cy="11" r="7" />, <path key="p" d="m20 20-3.5-3.5" />]),
  plus: svg(<path d="M12 5v14M5 12h14" />),
  send: svg([<path key="a" d="M12 19V5" />, <path key="b" d="m5 12 7-7 7 7" />]),
  close: svg(<path d="M18 6 6 18M6 6l12 12" />),
  reset: svg([<path key="a" d="M3 12a9 9 0 1 0 3-6.7" />, <path key="b" d="M3 3v6h6" />]),
  chevron: svg(<path d="m9 18 6-6-6-6" />),
};

export function iconFor(node: { type: string; icon?: string }): ReactElement | null {
  return ICONS[node.icon ?? node.type] ?? null;
}
