import { type LucideIcon } from "lucide-react";

// Consistent nav icon renderer — a lucide icon at the rail's size + stroke. Shared by the desktop
// NavigationRail and the mobile BottomDock so the sizing isn't duplicated. (rr: lucide-react icons.)
export function RailIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="rail-ico" size={20} strokeWidth={1.7} aria-hidden />;
}
